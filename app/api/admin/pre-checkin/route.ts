import { negar } from "@/lib/panel/permisos";
import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getBookingByConfirmacion } from "@/lib/db/admin";
import { getPreCheckin, bookingsConPreCheckin, setPreCheckinEmail } from "@/lib/db/pre-checkin";
import { rutaSegura } from "@/lib/api/responder";
import { zId, leerCuerpo } from "@/lib/api/cuerpo";
import { z } from "zod";

export const dynamic = "force-dynamic";

// El registro que llenó el huésped, para recepción.
//
// Sin `folio` devuelve sólo QUÉ reservas tienen registro (para pintar la
// palomita en la lista). Con `folio` devuelve el registro completo de esa
// reserva: es la ficha que recepción coteja contra la identificación al
// entregar la llave.
//
// Permiso `reservas:leer`: es trabajo de mostrador, no de mando.
export async function GET(req: NextRequest) {
  return rutaSegura("admin.preCheckin.get", async () => {
    const ctx = await getActiveHotel();
    if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
    const no = negar(ctx, "reservas:leer");
    if (no) return no;

    const q = new URL(req.url).searchParams;

    // El estado del interruptor. Vive en `hoteles.config`, que está revocado a la
    // llave del navegador, así que el panel no puede leerlo por su cuenta.
    if (q.get("ajuste")) {
      return NextResponse.json({
        activo: Boolean((ctx.hotel.config ?? {}).pre_checkin_enabled),
      });
    }

    const folio = q.get("folio");
    if (!folio) {
      // Sólo los ids, sin un solo dato personal: es lo que necesita la lista.
      return NextResponse.json({ conRegistro: [...(await bookingsConPreCheckin(ctx.hotelId))] });
    }

    if (!zId.safeParse(folio).success) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }
    const b = await getBookingByConfirmacion(ctx.hotelId, folio);
    if (!b) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

    const registro = await getPreCheckin(ctx.hotelId, b.id);
    return NextResponse.json({ registro });
  });
}

const AJUSTE = z.object({ activo: z.boolean() });

// Enciende o apaga el correo de registro previo del hotel.
//
// Permiso `sitio:editar` (MANDO) y no `reservas:escribir`: esto no es operar una
// reserva, es cambiar lo que Kora le manda a TODOS los huéspedes del hotel. Eso
// es una decisión del dueño, no del mostrador.
export async function PATCH(req: NextRequest) {
  return rutaSegura("admin.preCheckin.patch", async () => {
    const ctx = await getActiveHotel();
    if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
    const no = negar(ctx, "sitio:editar");
    if (no) return no;

    const c = await leerCuerpo(req, AJUSTE);
    if (!c.ok) return c.respuesta;

    const ok = await setPreCheckinEmail(ctx.hotelId, c.datos.activo);
    if (!ok) {
      return NextResponse.json({ error: "No se pudo guardar. Inténtalo de nuevo." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, activo: c.datos.activo });
  });
}
