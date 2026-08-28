import { z } from "zod";
import { negar } from "@/lib/panel/permisos";
import { rutaSegura } from "@/lib/api/responder";
import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getEquipo, altaMiembro, cambiarRol, quitarMiembro, ROLES_VALIDOS } from "@/lib/db/equipo";
import type { RolHotel } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// El equipo del hotel. Sólo el dueño: dar de alta a alguien es tocar identidad
// (quien invita puede darse a sí mismo cualquier rol).

const ROL = z.enum(ROLES_VALIDOS as [RolHotel, ...RolHotel[]]);

const ALTA = z.object({
  email: z.string().trim().email({ message: "correo-invalido" }).max(200),
  rol: ROL,
}).strict();

const CAMBIO = z.object({ userId: z.string().uuid(), rol: ROL }).strict();
const BAJA = z.object({ userId: z.string().uuid() }).strict();

const MENSAJES: Record<string, string> = {
  "no-se-pudo-buscar": "No pudimos revisar si esa persona ya tiene cuenta. Inténtalo de nuevo.",
  "no-se-pudo-crear": "No pudimos crear la cuenta con ese correo. Revísalo e inténtalo de nuevo.",
  "no-se-pudo-guardar": "No se pudo guardar. Inténtalo de nuevo.",
  "no-se-pudo-verificar": "No pudimos verificar quién es dueño del hotel. Inténtalo de nuevo.",
  "ultimo-dueno":
    "Es el único dueño del hotel. Nombra a otra persona como dueño antes de cambiarle el rol o quitarla.",
};
const traducir = (codigo?: string) =>
  (codigo && MENSAJES[codigo]) || "No se pudo completar la operación.";

/** El dueño de este hotel, o la respuesta de rechazo. */
async function soloDueno() {
  const ctx = await getActiveHotel();
  if (!ctx) return { error: NextResponse.json({ error: "no-auth" }, { status: 401 }) };
  const no = negar(ctx, "equipo:gestionar");
  if (no) return { error: no };
  return { ctx };
}

export async function GET() {
  return rutaSegura("admin.equipo.get", async () => {
    const { ctx, error } = await soloDueno();
    if (error) return error;
    return NextResponse.json(await getEquipo(ctx.hotelId));
  });
}

export async function POST(req: NextRequest) {
  return rutaSegura("admin.equipo.post", async () => {
    const { ctx, error } = await soloDueno();
    if (error) return error;

    const p = ALTA.safeParse(await req.json().catch(() => null));
    if (!p.success) {
      return NextResponse.json({ error: "Revisa el correo y el rol." }, { status: 400 });
    }

    const r = await altaMiembro(ctx.hotelId, p.data.email, p.data.rol);
    if (!r.ok) return NextResponse.json({ error: traducir(r.error) }, { status: 400 });
    return NextResponse.json({ ok: true, email: r.email, creado: r.creado });
  });
}

export async function PATCH(req: NextRequest) {
  return rutaSegura("admin.equipo.patch", async () => {
    const { ctx, error } = await soloDueno();
    if (error) return error;

    const p = CAMBIO.safeParse(await req.json().catch(() => null));
    if (!p.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

    const r = await cambiarRol(ctx.hotelId, p.data.userId, p.data.rol);
    if (!r.ok) return NextResponse.json({ error: traducir(r.error) }, { status: 400 });
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(req: NextRequest) {
  return rutaSegura("admin.equipo.delete", async () => {
    const { ctx, error } = await soloDueno();
    if (error) return error;

    const p = BAJA.safeParse(await req.json().catch(() => null));
    if (!p.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

    const r = await quitarMiembro(ctx.hotelId, p.data.userId);
    if (!r.ok) return NextResponse.json({ error: traducir(r.error) }, { status: 400 });
    return NextResponse.json({ ok: true });
  });
}
