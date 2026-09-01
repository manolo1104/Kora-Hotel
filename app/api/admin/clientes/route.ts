import { negar } from "@/lib/panel/permisos";
import { rutaSegura } from "@/lib/api/responder";
import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { buildCRM, saveGuestNote } from '@/lib/db/admin';
import { leerCuerpo, zEmail, zTextoLargo } from "@/lib/api/cuerpo";
import { z } from "zod";

export const dynamic = 'force-dynamic';

// GET → GuestProfile[] (cada uno trae nombre/email/telefono/totalReservas, que es
// lo que el autocomplete de ReservationModal consume, más historial para el CRM).
export async function GET() {
  return rutaSegura("admin.clientes.get", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });
  const no = negar(ctx, "clientes:leer");
  if (no) return no;

  const crm = await buildCRM(ctx.hotelId);
  return NextResponse.json(crm);
  });
}

const NOTA_SCHEMA = z.object({
  email: zEmail,
  notas: zTextoLargo.default(""),
});

export async function PATCH(req: NextRequest) {
  return rutaSegura("admin.clientes.patch", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });
  const no = negar(ctx, "clientes:escribir");
  if (no) return no;

  // Antes esto pasaba `email` y `notas` a la base sin mirarlos: un objeto o un
  // array llegaba tal cual a `saveGuestNote`.
  const c = await leerCuerpo(req, NOTA_SCHEMA);
  if (!c.ok) return c.respuesta;
  await saveGuestNote(ctx.hotelId, c.datos.email, c.datos.notas);
  return NextResponse.json({ ok: true });
  });
}
