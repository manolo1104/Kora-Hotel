import { negar } from "@/lib/panel/permisos";
import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getQuote, updateQuoteStatus, logAgentActivity } from '@/lib/db/admin';
import { parseNotas, type TourItem } from '@/lib/notas';
import { buildBrandedBookingEmailHtml, bookingBrandFromHotel, bookingFromHotel } from '@/lib/email/booking-branded';
import { enviarEmailOFallar } from '@/lib/email/resend';
import { rutaSegura } from '@/lib/api/responder';
import { zId } from "@/lib/api/cuerpo";

export const dynamic = 'force-dynamic';

interface PaqueteItem { nombre: string; habitacion: string; noches: number; personas: number; precio: number }

// El parser vive en `lib/notas.ts` (paso 7.3): había cinco copias y tres
// cortaban mal, cada una olvidando una marca distinta.
const parseTours = (notas: string) => parseNotas(notas).tours;
const parsePaquetes = (notas: string) => parseNotas(notas).paquetes;
const parseNotasCliente = (notas: string) => parseNotas(notas).cliente;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return rutaSegura('admin.cotizaciones.sendEmail', async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });
  const no = negar(ctx, "marketing:enviar");
  if (no) return no;

  const { id } = await params;
  if (!zId.safeParse(id).success) {
    return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
  }
  const q = await getQuote(ctx.hotelId, id);
  if (!q) return NextResponse.json({ error: 'Cotización no encontrada' }, { status: 404 });
  if (!q.email) return NextResponse.json({ error: 'Sin email en esta cotización' }, { status: 400 });

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'Email no configurado en este hotel (falta RESEND_API_KEY)' }, { status: 503 });
  }
  const FROM = bookingFromHotel(ctx.hotel);

  const suites = q.suite
    .split(',')
    .map(s => s.replace(/\s*\([^)]*\)/g, '').trim())
    .filter(Boolean);
  const tours = parseTours(q.notas || '');
  const paquetes = parsePaquetes(q.notas || '');
  const tourItems: TourItem[] = [
    ...tours,
    ...paquetes.map(p => ({ nombre: `🎁 ${p.nombre}`, personas: 1, precio: p.precio })),
  ];

  const html = buildBrandedBookingEmailHtml(bookingBrandFromHotel(ctx.hotel), {
    kind: 'cotizacion',
    confirmacion: q.id,
    cliente: q.cliente || '—',
    suites,
    checkin: q.checkin,
    checkout: q.checkout,
    noches: q.noches || 1,
    huespedes: suites.length * 2,
    total: q.precioTotal,
    notasCliente: parseNotasCliente(q.notas || ''),
    tourItems,
  });

  // El orden importa y antes estaba mal. `resend.emails.send()` NUNCA lanza:
  // ante un fallo de red o un dominio sin verificar devuelve `{data:null,error}`
  // y sigue, así que el try/catch de aquí no se disparaba nunca y la cotización
  // se marcaba ENVIADA con el correo perdido. Ahora primero sale el correo —o
  // `enviarEmailOFallar` lanza y `rutaSegura` responde 500— y sólo después se
  // cambia el estado.
  await enviarEmailOFallar({
    from: FROM,
    to: q.email,
    subject: `Tu cotización ${q.id} — ${ctx.hotel.nombre}`,
    html,
  });
  await updateQuoteStatus(ctx.hotelId, q.id, 'ENVIADA');
  await logAgentActivity(ctx.hotelId, 'email_confirmacion', q.id);
  return NextResponse.json({ ok: true });
  });
}
