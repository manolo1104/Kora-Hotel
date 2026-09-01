import { negar } from "@/lib/panel/permisos";
import { rutaSegura } from "@/lib/api/responder";
import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getGuestNotes, saveGuestNote } from "@/lib/db/admin";
import { leerCuerpo, zEmail, zTextoLargo } from "@/lib/api/cuerpo";
import { z } from "zod";

export const dynamic = "force-dynamic";

// GET → todas las notas del hotel activo, mapa { email(lowercase): notas }.
export async function GET() {
  return rutaSegura("admin.guestNotes.get", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "clientes:leer");
  if (no) return no;
  const notas = await getGuestNotes(ctx.hotelId);
  return NextResponse.json(notas);
  });
}

const NOTA_SCHEMA = z.object({
  email: zEmail,
  notas: zTextoLargo.default(""),
});

// POST { email, notas } → upsert de la nota del huésped.
export async function POST(req: Request) {
  return rutaSegura("admin.guestNotes.post", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "clientes:escribir");
  if (no) return no;
  // `notas` no tenía tope: una nota de 40 MB entraba en la base y salía luego en
  // cada listado, en cada correo y en el Excel que se descarga el hotelero.
  const c = await leerCuerpo(req, NOTA_SCHEMA);
  if (!c.ok) return c.respuesta;
  await saveGuestNote(ctx.hotelId, c.datos.email, c.datos.notas);
  return NextResponse.json({ ok: true });
  });
}
