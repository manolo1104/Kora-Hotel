import { negar } from "@/lib/panel/permisos";
import { z } from "zod";
import { rutaSegura } from "@/lib/api/responder";
import { NextRequest, NextResponse } from 'next/server';
import { getActiveHotel } from '@/lib/panel/active-hotel';
import { getAllBookings, updateBooking, cancelBooking, splitRooms } from '@/lib/db/admin';
import { getOccupiedRoomNames } from '@/lib/db/availability';
import { liberarExperienciaVentas } from '@/lib/db/experiencias';
import { resolveHotelAvisoEmail, sendAvisoCancelacionHotel, sendCancelacionHuesped, sendModificacionHuesped } from '@/lib/email/reserva';
import { bookingBrandFromHotel, bookingFromHotel } from '@/lib/email/booking-branded';

export const dynamic = 'force-dynamic';

// Los campos que el modal de reservas puede mandar. `habitacion` (singular) es
// el nombre que usa el modal; se traduce abajo. `.strict()` rechaza el resto —
// incluido `hotel_id`, que era la llave para mover una reserva de hotel.
const PATCH_RESERVA = z
  .object({
    cliente: z.string().max(200).optional(),
    telefono: z.string().max(50).optional(),
    email: z.string().max(200).optional(),
    checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    noches: z.number().int().min(0).max(365).optional(),
    huespedes: z.number().int().min(0).max(100).optional(),
    total: z.number().min(0).optional(),
    anticipo: z.number().min(0).optional(),
    habitacion: z.string().max(500).optional(),
    habitaciones: z.string().max(500).optional(),
    notas: z.string().max(20000).optional(),
    estado: z.enum(["CONFIRMADA", "MANUAL", "CANCELADA", "REEMBOLSADA", "PENDIENTE"]).optional(),
  })
  .strict();

/** ¿Es un correo al que sí se le puede escribir? */
const correoValido = (e?: string | null) => Boolean(e && e !== 'N/A' && e.includes('@'));

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return rutaSegura("admin.reservas.id.patch", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });
  const no = negar(ctx, "reservas:escribir");
  if (no) return no;

  const { id } = await params; // el cliente envía la confirmación (folio)

  // Se valida ANTES de tocar nada, y con `.strict()`: una clave que no esté en
  // la lista es un 400 explícito, no un silencio. La lista blanca de
  // `updateBooking` es la segunda capa; ésta es la que le dice al que lo intenta
  // que se le vio.
  const parseado = PATCH_RESERVA.safeParse(await req.json());
  if (!parseado.success) {
    return NextResponse.json(
      { error: "Datos inválidos. Revisa los campos e intenta de nuevo." },
      { status: 400 },
    );
  }
  // El modal envía "habitacion" (singular) pero updateBooking espera "habitaciones".
  const { habitacion, ...resto } = parseado.data;
  const raw = { ...resto, habitaciones: resto.habitaciones ?? habitacion };

  const bookings = await getAllBookings(ctx.hotelId);
  const booking = bookings.find(b => b.confirmacion === id);
  if (!booking) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  // Validación de fechas: si se editan, la salida debe ser posterior a la llegada.
  const newCheckin  = raw.checkin  ?? booking.checkin;
  const newCheckout = raw.checkout ?? booking.checkout;
  if ((raw.checkin || raw.checkout) && newCheckin && newCheckout && newCheckout <= newCheckin) {
    return NextResponse.json({ error: 'La salida debe ser posterior a la llegada.' }, { status: 400 });
  }

  // ANTI-SOBREVENTA AL EDITAR: si cambian fechas o cuartos (y la reserva no está
  // cancelada), revalidar disponibilidad ANTES de aplicar. updateBooking borra y
  // re-crea los blocks sin revisar solape, así que sin este chequeo el panel podía
  // sobrevender al mover una reserva a fechas/cuartos ya ocupados por otra.
  const cambiaFechas   = raw.checkin !== undefined || raw.checkout !== undefined;
  const cambiaCuartos  = raw.habitaciones !== undefined;
  const estadoFinal    = raw.estado ?? booking.estado;
  if ((cambiaFechas || cambiaCuartos) && estadoFinal !== 'CANCELADA') {
    const roomsNuevos = splitRooms(String(raw.habitaciones ?? booking.habitaciones ?? ''));
    if (roomsNuevos.length && newCheckin && newCheckout) {
      try {
        // Excluir los blocks de esta misma reserva (si no, chocaría consigo misma).
        const ocupados = await getOccupiedRoomNames(
          ctx.hotelId, newCheckin, newCheckout, null, booking.id,
        );
        const choque = roomsNuevos.filter((r) => ocupados.includes(r));
        if (choque.length) {
          return NextResponse.json(
            { error: `No se puede guardar: ${choque.join(', ')} ya está(n) ocupado(s) en esas fechas.` },
            { status: 409 },
          );
        }
      } catch (e) {
        // Fail-closed: ante error de disponibilidad NO aplicamos el cambio
        // (sobrevender es peor que pedir reintentar).
        console.error('PATCH reserva revalidación disponibilidad error:', e);
        return NextResponse.json(
          { error: 'No se pudo verificar la disponibilidad. Intenta de nuevo.' },
          { status: 503 },
        );
      }
    }
  }

  // updateBooking re-sincroniza los bloqueos RESERVADO (por booking_id) cuando
  // cambian fechas/cuartos; por eso NO usamos block/unblockRooms aquí (evita
  // mezclar estados RESERVADO/BLOQUEADO y dejar fechas viejas ocupadas).
  // El resultado SE MIRA. `updateBooking` re-sincroniza los bloqueos con el RPC
  // atómico; si el cuarto nuevo ya está ocupado, la ocupación vieja sigue en pie
  // (el rollback la conservó) y hay que decirlo aquí. Antes esto respondía
  // ok:true y le escribía al huésped aunque la ocupación se hubiera evaporado.
  const edicion = await updateBooking(ctx.hotelId, booking.id, raw);
  if (!edicion.ok) {
    return NextResponse.json(
      {
        error: edicion.unavailable
          ? "Ese cuarto ya está ocupado en esas fechas. La reserva se quedó como estaba."
          : "No pudimos aplicar el cambio. Inténtalo de nuevo.",
        unavailable: edicion.unavailable === true,
      },
      { status: edicion.unavailable ? 409 : 500 },
    );
  }
  // Cancelada desde el panel → sus lugares de experiencias quedan libres.
  const cancelaAhora = raw.estado === 'CANCELADA' && booking.estado !== 'CANCELADA';
  if (cancelaAhora) {
    await liberarExperienciaVentas(ctx.hotelId, booking.confirmacion);
  }

  // RECORDATORIO DEL REEMBOLSO AL HOTELERO. Kora no emite reembolsos de
  // cancelación (decisión del 26 ago 2026): los coordina el hotel desde su
  // propia cuenta de Stripe. Pero al huésped su correo SÍ le dice "el hotel te
  // lo devuelve", así que si nadie se lo recuerda al hotelero, la promesa la
  // hace Kora y la incumple el hotel — y a los doce días el huésped abre una
  // disputa que se cobra en la cuenta Connect DEL HOTEL, con penalización.
  // Sólo cuando hubo anticipo: sin dinero de por medio no hay nada que devolver.
  if (cancelaAhora && booking.anticipo > 0) {
    try {
      const avisoTo = await resolveHotelAvisoEmail({
        id: ctx.hotelId,
        extras: ctx.hotel.extras,
        config: ctx.hotel.config,
      });
      if (avisoTo) {
        await sendAvisoCancelacionHotel(avisoTo, {
          hotelNombre: ctx.hotel.nombre,
          panelUrl: `${new URL(req.url).origin}/panel/${ctx.hotel.slug}/reservas`,
          confirmacion: booking.confirmacion,
          cliente: booking.cliente,
          email: booking.email,
          habitaciones: String(raw.habitaciones ?? booking.habitaciones ?? ''),
          checkin: newCheckin,
          checkout: newCheckout,
          anticipo: booking.anticipo,
          origen: "panel",
        });
      }
    } catch (e) {
      console.error("recordatorio de reembolso al hotel falló:", e);
    }
  }

  // AVISO AL HUÉSPED. Antes el hotel le movía fechas o cuarto (o le cancelaba)
  // y el huésped no se enteraba por ningún lado. Best-effort: el cambio en la
  // BD ya está aplicado y no se revierte si el correo falla.
  if (correoValido(booking.email)) {
    const brand = bookingBrandFromHotel(ctx.hotel);
    const from = bookingFromHotel(ctx.hotel);
    const nuevasHabs = String(raw.habitaciones ?? booking.habitaciones ?? '');
    try {
      if (cancelaAhora) {
        await sendCancelacionHuesped(
          booking.email,
          {
            hotelNombre: ctx.hotel.nombre,
            confirmacion: booking.confirmacion,
            cliente: booking.cliente,
            habitaciones: nuevasHabs,
            checkin: newCheckin,
            checkout: newCheckout,
            anticipo: booking.anticipo,
            // La canceló el hotel: el anticipo se devuelve, sea la tarifa que sea.
            reembolsable: true,
            lang: booking.lang,
            brand,
          },
          from,
        );
      } else if (cambiaFechas || cambiaCuartos) {
        const total = Number(raw.total ?? booking.total) || 0;
        const anticipo = Number(raw.anticipo ?? booking.anticipo) || 0;
        await sendModificacionHuesped(
          booking.email,
          {
            hotelNombre: ctx.hotel.nombre,
            confirmacion: booking.confirmacion,
            cliente: booking.cliente,
            habitaciones: nuevasHabs,
            checkin: newCheckin,
            checkout: newCheckout,
            noches: Number(raw.noches ?? booking.noches) || 1,
            huespedes: Number(raw.huespedes ?? booking.huespedes) || undefined,
            total,
            anticipo,
            anterior: {
              habitaciones: booking.habitaciones,
              checkin: booking.checkin,
              checkout: booking.checkout,
            },
            portalUrl: `${new URL(req.url).origin}/reserva/consultar`,
            lang: booking.lang,
            brand,
          },
          from,
        );
      }
    } catch (e) {
      console.error('aviso de cambio al huésped falló:', e);
    }
  }

  return NextResponse.json({ ok: true });
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return rutaSegura("admin.reservas.id.delete", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: 'no-auth' }, { status: 401 });
  const no = negar(ctx, "reservas:cancelar");
  if (no) return no;

  const { id } = await params;

  const bookings = await getAllBookings(ctx.hotelId);
  const booking = bookings.find(b => b.confirmacion === id);
  if (!booking) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });

  // cancelBooking marca CANCELADA y borra los blocks ligados (libera disponibilidad).
  await cancelBooking(ctx.hotelId, booking.id);
  await liberarExperienciaVentas(ctx.hotelId, booking.confirmacion);

  // RECORDATORIO DEL REEMBOLSO AL HOTELERO. Kora no emite reembolsos de
  // cancelación (decisión del 26 ago 2026): los coordina el hotel desde su
  // propia cuenta de Stripe. Pero al huésped su correo SÍ le dice "el hotel te
  // lo devuelve", así que si nadie se lo recuerda al hotelero, la promesa la
  // hace Kora y la incumple el hotel — y a los doce días el huésped abre una
  // disputa que se cobra en la cuenta Connect DEL HOTEL, con penalización.
  // Sólo cuando hubo anticipo: sin dinero de por medio no hay nada que devolver.
  if (booking.anticipo > 0) {
    try {
      const avisoTo = await resolveHotelAvisoEmail({
        id: ctx.hotelId,
        extras: ctx.hotel.extras,
        config: ctx.hotel.config,
      });
      if (avisoTo) {
        await sendAvisoCancelacionHotel(avisoTo, {
          hotelNombre: ctx.hotel.nombre,
          panelUrl: `${new URL(req.url).origin}/panel/${ctx.hotel.slug}/reservas`,
          confirmacion: booking.confirmacion,
          cliente: booking.cliente,
          email: booking.email,
          habitaciones: booking.habitaciones,
          checkin: booking.checkin,
          checkout: booking.checkout,
          anticipo: booking.anticipo,
          origen: "panel",
        });
      }
    } catch (e) {
      console.error("recordatorio de reembolso al hotel falló:", e);
    }
  }

  // Comprobante de cancelación al huésped (best-effort).
  if (correoValido(booking.email)) {
    try {
      await sendCancelacionHuesped(
        booking.email,
        {
          hotelNombre: ctx.hotel.nombre,
          confirmacion: booking.confirmacion,
          cliente: booking.cliente,
          habitaciones: booking.habitaciones,
          checkin: booking.checkin,
          checkout: booking.checkout,
          anticipo: booking.anticipo,
          reembolsable: true, // la canceló el hotel
          lang: booking.lang,
          brand: bookingBrandFromHotel(ctx.hotel),
        },
        bookingFromHotel(ctx.hotel),
      );
    } catch (e) {
      console.error('comprobante de cancelación al huésped falló:', e);
    }
  }

  return NextResponse.json({ ok: true });
  });
}
