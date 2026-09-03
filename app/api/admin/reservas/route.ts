import { politicaDelHotel } from "@/lib/booking";
import { negar } from "@/lib/panel/permisos";
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getAllBookings, createManualBooking, checkinBooking } from '@/lib/db/admin';
import { checkAvailability } from '@/lib/db/availability';
import type { HotelRow } from '@/lib/tenant';
import {
  resolveHotelAvisoEmail,
  sendAvisoReservaHotel,
  sendConfirmacionReserva,
} from '@/lib/email/reserva';
import { bookingBrandFromHotel } from '@/lib/email/booking-branded';

export const dynamic = 'force-dynamic';

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Las fechas deben ser AAAA-MM-DD.");

/** Lo que el panel puede mandar al meter una reserva a mano. */
const ManualBookingBody = z
  .object({
    cliente: z.string().max(160).optional(),
    telefono: z.string().max(40).optional(),
    email: z.string().max(160).optional(),
    // Los tres que definen la OCUPACIÓN son obligatorios: sin ellos no se puede
    // saber si el cuarto está libre, y antes se creaba la reserva igual.
    habitacion: z.string().min(1, "Elige al menos una habitación."),
    checkin: FECHA,
    checkout: FECHA,
    noches: z.coerce.number().int().min(0).max(365).optional(),
    huespedes: z.coerce.number().int().min(1).max(60).optional(),
    total: z.coerce.number().min(0).max(10_000_000).optional(),
    anticipo: z.coerce.number().min(0).max(10_000_000).optional(),
    notas: z.string().max(20_000).optional(),
    /** Meter la reserva ENCIMA de otra, a sabiendas. Deja rastro en las notas. */
    forzar: z.boolean().optional(),
    /**
     * El huésped está AQUÍ, delante del mostrador (walk-in). Registra la llegada
     * en el mismo paso que crea la reserva, para que el cuarto salga ocupado sin
     * tener que ir a buscarla a la lista y pulsar un segundo botón.
     */
    llegoYa: z.boolean().optional(),
  })
  .refine((d) => d.checkout > d.checkin, {
    message: "La salida tiene que ser posterior a la llegada.",
    path: ["checkout"],
  });

export async function GET(req: NextRequest) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });
  const no = negar(ctx, "reservas:leer");
  if (no) return no;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.toLowerCase() || '';
  const suite = searchParams.get('suite') || '';

  const bookings = await getAllBookings(ctx.hotelId);
  const filtered = bookings.filter(b => {
    if (search && !b.cliente.toLowerCase().includes(search) &&
        !b.email.toLowerCase().includes(search) &&
        !b.confirmacion.toLowerCase().includes(search)) return false;
    if (suite && !b.habitaciones.includes(suite)) return false;
    return true;
  });

  return NextResponse.json(filtered);
}

export async function POST(req: NextRequest) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });
  const no = negar(ctx, "reservas:escribir");
  if (no) return no;

  try {
    // VALIDACIÓN DE VERDAD. Antes la comprobación de disponibilidad estaba dentro
    // de un `if (data.checkin && data.checkout && data.habitacion)`: bastaba con
    // que faltara CUALQUIERA de los tres para que se saltara entera y la reserva
    // se creara a ciegas (K-183). Ahora los campos que definen la ocupación son
    // obligatorios y el formato se valida antes de tocar la base.
    const parsed = ManualBookingBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos de la reserva inválidos." },
        { status: 400 },
      );
    }
    const data = parsed.data;
    const forzar = data.forzar === true;

    // El CSV de habitaciones puede traer varias suites separadas por coma.
    const rooms = String(data.habitacion)
      .split(',')
      .map((r: string) => r.replace(/\s*\([^)]*\)/g, '').trim())
      .filter(Boolean);
    if (rooms.length === 0) {
      return NextResponse.json({ error: "Elige al menos una habitación." }, { status: 400 });
    }

    // Aviso rápido para la interfaz. La barrera de verdad es el candado atómico
    // de `createManualBooking`; esto sólo da un mensaje más claro y más pronto.
    if (!forzar) {
      const avail = await checkAvailability(ctx.hotelId, data.checkin, data.checkout, rooms);
      if (avail.unavailableRooms.length > 0) {
        return NextResponse.json(
          {
            error: `${avail.unavailableRooms.join(', ')} no está disponible del ${data.checkin} al ${data.checkout}. Verifica el calendario.`,
            unavailable: true,
          },
          { status: 409 }
        );
      }
    }

    const creada = await createManualBooking(ctx.hotelId, {
      cliente: data.cliente ?? '',
      telefono: data.telefono ?? '',
      email: data.email ?? '',
      habitacion: data.habitacion,
      checkin: data.checkin,
      checkout: data.checkout,
      noches: data.noches ?? 0,
      huespedes: data.huespedes ?? 1,
      total: data.total ?? 0,
      notas: data.notas ?? '',
      anticipo: data.anticipo,
    }, ctx.hotel.prefijo_confirmacion, { forzar, forzadoPor: ctx.userId },
      // La política vigente del hotel se guarda CON la reserva: si el
      // hotelero la cambia después, esta reserva conserva la suya.
      politicaDelHotel(ctx.hotel));

    if (!creada.ok || !creada.confirmacion) {
      // El candado ganó: alguien se le adelantó entre el aviso de arriba y el
      // alta. Es exactamente la sobreventa que este paso viene a impedir.
      if (creada.unavailable) {
        return NextResponse.json(
          {
            error: "Ese cuarto acaba de ocuparse en esas fechas. Recarga el calendario y vuelve a intentarlo.",
            unavailable: true,
          },
          { status: 409 },
        );
      }
      console.error("[admin.reservas.crear]", creada.error);
      return NextResponse.json({ error: "No se pudo guardar. Intenta de nuevo." }, { status: 500 });
    }
    const confirmacion = creada.confirmacion;

    // WALK-IN: el huésped ya está aquí. Se registra su llegada en el acto para
    // que el cuarto aparezca ocupado de inmediato — que es lo que el hotelero
    // echaba de menos de AZHotel: "se puede hacer un registro sin reserva y
    // automáticamente la habitación aparece como ocupada".
    //
    // Best-effort a propósito: la reserva YA está creada y cobrada. Si esto
    // falla, el cuarto se ocupa igual por fechas (entra hoy) y recepción puede
    // pulsar "Ya llegó" en la lista. Tumbar el alta por esto sería peor.
    let llegadaRegistrada = false;
    if (data.llegoYa) {
      const r = await checkinBooking(ctx.hotelId, confirmacion);
      llegadaRegistrada = r.ok;
      if (!r.ok) {
        console.error(`[admin.reservas.crear] reserva ${confirmacion} creada pero la llegada no se registró: ${r.error}`);
      }
    }

    // TODO loyalty: en Paraíso se llamaba checkAndEnrollLoyalty aquí. Kora aún no
    // tiene módulo de lealtad → se omite.

    // Correos post-reserva (best-effort: nunca tumban la creación de la reserva).
    // Mismo patrón que el webhook del motor (app/api/h/webhooks/stripe): aviso al
    // hotel con destinatario RESUELTO (panel → config → cuenta del dueño) y
    // confirmación PREMIUM al huésped con la marca del hotel.
    // CON await: sin él Vercel congela la función al responder y el huésped se
    // queda sin su confirmación (ver la nota en /api/panel/crear-hotel).
    await notifyBookingEmails(req, ctx.hotel, confirmacion, data).catch((e) => console.error("[admin/reservas] ignorado:", e));

    return NextResponse.json({ ok: true, confirmacion, llegadaRegistrada });
  } catch (e) {
    // El detalle (nombres de tabla, restricciones, columnas) se queda en el log
    // del servidor; al navegador sólo va un mensaje que el hotelero pueda leer.
    console.error("[admin.reservas.crear]", e);
    return NextResponse.json({ error: "No se pudo guardar. Intenta de nuevo." }, { status: 500 });
  }
}

interface ManualBookingData {
  cliente?: string; telefono?: string; email?: string; habitacion?: string;
  checkin?: string; checkout?: string; huespedes?: number | string;
  total?: number | string; anticipo?: number | string;
}

async function notifyBookingEmails(
  req: NextRequest,
  hotel: HotelRow,
  confirmacion: string,
  data: ManualBookingData,
) {
  const origin = new URL(req.url).origin;
  const num = (v: unknown) => Number(v) || 0;
  // El CSV de habitaciones puede traer varias suites separadas por coma y con
  // sufijos entre paréntesis: los limpiamos igual que en la verificación de arriba.
  const habitaciones = String(data.habitacion ?? '')
    .split(',')
    .map((r) => r.replace(/\s*\([^)]*\)/g, '').trim())
    .filter(Boolean);
  const total = num(data.total);
  const anticipo = num(data.anticipo);
  const huespedes = num(data.huespedes) || 1;

  // 1) Aviso al hotel — destinatario resuelto correctamente (no a Kora).
  const avisoTo = await resolveHotelAvisoEmail(hotel).catch(() => '');
  if (avisoTo) {
    await sendAvisoReservaHotel(avisoTo, {
      hotelNombre: hotel.nombre,
      panelUrl: `${origin}/panel/${hotel.slug}/reservas`,
      confirmacion,
      cliente: data.cliente || null,
      telefono: data.telefono || null,
      email: data.email || null,
      habitaciones,
      checkin: data.checkin || '',
      checkout: data.checkout || '',
      huespedes,
      total,
      anticipo,
      // Una reserva metida a mano NO pasa por Stripe: no hay tarjeta en
      // garantía que valga. Antes se mandaba `pagoEnHotel: anticipo <= 0` y el
      // aviso al hotel afirmaba una garantía inexistente (K-253).
      pagoEnHotel: false,
    }).catch((e) => console.error("[admin/reservas] ignorado:", e));
  }

  // 2) Confirmación al huésped (gated por email válido dentro del helper).
  if ((data.email ?? '').includes('@')) {
    await sendConfirmacionReserva(
      data.email!,
      {
        hotelNombre: hotel.nombre,
        confirmacion,
        habitaciones,
        checkin: data.checkin || '',
        checkout: data.checkout || '',
        anticipo,
        pendiente: Math.max(0, total - anticipo),
        cliente: data.cliente || null,
        huespedes,
        portalUrl: `${origin}/reserva/consultar`,
        lang: 'es',
        brand: bookingBrandFromHotel(hotel),
      },
      (hotel.config?.email_from as string) || null,
    ).catch((e) => console.error("[admin/reservas] ignorado:", e));
  }
}
