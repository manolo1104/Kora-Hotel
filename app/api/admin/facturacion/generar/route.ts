import { negar } from "@/lib/panel/permisos";
import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getAllBookings } from '@/lib/db/admin';
import { buildCfdiPayload, createCfdi, facturamaConfigured, FacturamaError, RECEPTOR_PUBLICO, type CfdiReceiver } from '@/lib/admin/facturama';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Aislamiento multi-tenant: el hotel sale de la sesión + cookie, nunca del body.
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });
  const no = negar(ctx, "facturacion:usar");
  if (no) return no;

  // Degradación elegante: si el PAC no está configurado (CSD/credenciales), no truena.
  if (!facturamaConfigured()) {
    return NextResponse.json(
      { error: 'Facturación no configurada aún (faltan las credenciales de Facturama).' },
      { status: 503 },
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  // El monto y los datos de la estancia salen de la reserva real del hotel,
  // localizada por su folio/confirmación dentro de ESTE hotel (no se confía en
  // el total que mande el cliente). Si no hay confirmación, se usa el body como
  // respaldo (alta sin reserva ligada).
  const confirmacion = typeof body?.confirmacion === 'string' ? body.confirmacion.trim() : '';
  let total = Number(body?.total);
  let descripcion: string =
    (typeof body?.descripcion === 'string' && body.descripcion.trim()) || 'Servicio de hospedaje';

  if (confirmacion) {
    const bookings = await getAllBookings(ctx.hotelId);
    const booking = bookings.find((b) => b.confirmacion === confirmacion);
    if (!booking) {
      return NextResponse.json({ error: 'No se encontró la reserva a facturar en este hotel.' }, { status: 404 });
    }
    if (booking.estado === 'CANCELADA' || booking.total <= 0) {
      return NextResponse.json({ error: 'Esa reserva no es facturable (cancelada o sin monto).' }, { status: 400 });
    }
    // El total a timbrar es el de la reserva en la base, no el del cliente.
    total = booking.total;
    descripcion = `Servicio de hospedaje — ${booking.habitaciones || 'habitación'} — ${booking.noches} noche(s) (${booking.checkin} a ${booking.checkout})`;
  }

  if (!total || total <= 0) {
    return NextResponse.json({ error: 'El monto a facturar es inválido.' }, { status: 400 });
  }

  // Receptor: si no mandan RFC, factura a público en general.
  const r = body?.receiver || {};
  const receiver: CfdiReceiver = r?.Rfc
    ? {
        Rfc: String(r.Rfc),
        Name: String(r.Name || ''),
        CfdiUse: String(r.CfdiUse || 'G03'),
        FiscalRegime: String(r.FiscalRegime || '601'),
        TaxZipCode: String(r.TaxZipCode || ''),
      }
    : RECEPTOR_PUBLICO;

  // Validación mínima para receptor con RFC.
  if (r?.Rfc) {
    if (!receiver.Name) return NextResponse.json({ error: 'Falta la razón social del receptor.' }, { status: 400 });
    if (!receiver.TaxZipCode) return NextResponse.json({ error: 'Falta el código postal del receptor.' }, { status: 400 });
  }

  const payload = buildCfdiPayload({
    total,
    descripcion,
    receiver,
    paymentForm: body?.paymentForm,
    paymentMethod: body?.paymentMethod,
  });

  try {
    const result = await createCfdi(payload);
    return NextResponse.json({
      ok: true,
      id: result.id,
      uuid: result.uuid,
      folio: result.folio,
      serie: result.serie,
      total: result.total,
      fecha: result.fecha,
    });
  } catch (e) {
    if (e instanceof FacturamaError) {
      console.error('[facturacion/generar] Facturama error', e.status, JSON.stringify(e.detail));
      // El detalle del PAC suele traer el motivo exacto (RFC inválido, CP, etc.)
      const detail = typeof e.detail === 'string'
        ? e.detail
        : (e.detail as any)?.Message || (e.detail as any)?.ModelState || e.detail;
      return NextResponse.json(
        { error: 'El PAC rechazó la factura.', status: e.status, detail },
        { status: 502 },
      );
    }
    console.error('[facturacion/generar] Error inesperado', e);
    return NextResponse.json({ error: 'Error inesperado al generar la factura.' }, { status: 500 });
  }
}
