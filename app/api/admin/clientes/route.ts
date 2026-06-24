import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { buildCRM, saveGuestNote } from '@/lib/db/admin';

export const dynamic = 'force-dynamic';

// GET → GuestProfile[] (cada uno trae nombre/email/telefono/totalReservas, que es
// lo que el autocomplete de ReservationModal consume, más historial para el CRM).
export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });

  const crm = await buildCRM(ctx.hotelId);
  return NextResponse.json(crm);
}

export async function PATCH(req: NextRequest) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });

  const { email, notas } = await req.json();
  await saveGuestNote(ctx.hotelId, email, notas);
  return NextResponse.json({ ok: true });
}
