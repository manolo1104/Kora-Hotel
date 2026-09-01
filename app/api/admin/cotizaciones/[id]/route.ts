import { negar } from "@/lib/panel/permisos";
import { rutaSegura } from "@/lib/api/responder";
import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getQuote, updateQuote, deleteQuote } from '@/lib/db/admin';
import { leerCuerpo, zTextoCorto, zTextoLargo, zEmail, zFecha } from "@/lib/api/cuerpo";
import { z } from "zod";

export const dynamic = 'force-dynamic';

// `precioTotal` lo traduce `updateQuote` a `precio_total`.
const EDITAR_SCHEMA = z
  .object({
    cliente: zTextoCorto,
    telefono: z.string().trim().max(40),
    email: z.union([zEmail, z.literal("")]),
    suite: zTextoCorto,
    checkin: zFecha,
    checkout: zFecha,
    noches: z.number().int().min(1).max(365),
    precioTotal: z.number().min(0).max(10_000_000),
    estado: z.enum(["BORRADOR", "ENVIADA", "ACEPTADA", "EXPIRADA"]),
    notas: zTextoLargo,
  })
  .partial();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return rutaSegura("admin.cotizaciones.id.patch", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });
  const no = negar(ctx, "cotizaciones:escribir");
  if (no) return no;

  const { id } = await params;

  // La lista blanca de antes decidía QUÉ campos pasaban, pero no su forma: un
  // `noches: "muchas"` o un `estado: "PATATA"` entraban igual y reventaban
  // contra el CHECK de la tabla. El esquema hace las dos cosas.
  const c = await leerCuerpo(req, EDITAR_SCHEMA);
  if (!c.ok) return c.respuesta;

  const quote = await getQuote(ctx.hotelId, id);
  if (!quote) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  await updateQuote(ctx.hotelId, id, c.datos);
  return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return rutaSegura("admin.cotizaciones.id.delete", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });
  const no = negar(ctx, "cotizaciones:escribir");
  if (no) return no;

  const { id } = await params;
  const quote = await getQuote(ctx.hotelId, id);
  if (!quote) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  await deleteQuote(ctx.hotelId, id);
  return NextResponse.json({ ok: true });
  });
}
