import { z } from "zod";
import { negar } from "@/lib/panel/permisos";
import { rutaSegura } from "@/lib/api/responder";
import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getEquipo, altaMiembro, actualizarMiembro, quitarMiembro, ROLES_VALIDOS } from "@/lib/db/equipo";
import type { RolHotel } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// El equipo del hotel. Sólo el dueño: dar de alta a alguien es tocar identidad
// (quien invita puede darse a sí mismo cualquier rol).

const ROL = z.enum(ROLES_VALIDOS as [RolHotel, ...RolHotel[]]);

// Las pestañas que ve la persona. Se validan como texto suelto a propósito:
// `sanearPantallas` (lib/panel/pantallas.ts) es quien decide de verdad, y
// descarta lo que no reconoce o lo que el puesto no incluye. Un id inventado
// aquí no puede dar acceso a nada — sólo se ignora. El tope de 40 existe para
// que nadie mande un array de un millón de cadenas.
const PANTALLAS = z.array(z.string().max(40)).max(40);

const ALTA = z.object({
  email: z.string().trim().email({ message: "correo-invalido" }).max(200),
  rol: ROL,
  pantallas: PANTALLAS.optional(),
}).strict();

const CAMBIO = z
  .object({
    userId: z.string().uuid(),
    rol: ROL.optional(),
    pantallas: PANTALLAS.nullable().optional(),
  })
  .strict()
  .refine((v) => v.rol !== undefined || v.pantallas !== undefined, {
    message: "nada-que-cambiar",
  });
const BAJA = z.object({ userId: z.string().uuid() }).strict();

const MENSAJES: Record<string, string> = {
  "no-se-pudo-buscar": "No pudimos revisar si esa persona ya tiene cuenta. Inténtalo de nuevo.",
  "no-se-pudo-crear": "No pudimos crear la cuenta con ese correo. Revísalo e inténtalo de nuevo.",
  "no-se-pudo-guardar": "No se pudo guardar. Inténtalo de nuevo.",
  "no-se-pudo-verificar": "No pudimos verificar quién es dueño del hotel. Inténtalo de nuevo.",
  "ultimo-dueno":
    "Es el único dueño del hotel. Nombra a otra persona como dueño antes de cambiarle el rol o quitarla.",
  "sin-pantallas":
    "Déjale al menos una pestaña. Sin ninguna entraría a un panel vacío y parecería que el sistema falla.",
  "no-esta-en-el-hotel": "Esa persona ya no está en el hotel. Recarga la página.",
  // Sólo puede salir si el SQL de pantallas no se ha corrido. Se dice con todas
  // sus letras: quien ve este mensaje es Manolo, no un hotelero.
  "falta-sql-pantallas":
    "Elegir pestañas todavía no está activo en la base de datos. Corre sql/kora-equipo-pantallas.sql en Supabase; mientras tanto, cada quien ve todas las de su puesto.",
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

    const r = await altaMiembro(ctx.hotelId, p.data.email, p.data.rol, p.data.pantallas);
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

    const r = await actualizarMiembro(ctx.hotelId, p.data.userId, {
      rol: p.data.rol,
      pantallas: p.data.pantallas,
    });
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
