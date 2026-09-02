import { negar } from "@/lib/panel/permisos";
import { rutaSegura } from "@/lib/api/responder";
import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { checkinBooking, deshacerCheckin } from "@/lib/db/admin";
import { zId } from "@/lib/api/cuerpo";

export const dynamic = "force-dynamic";

// Check-in de una reserva: recepción AFIRMA que el huésped llegó.
//
// POR QUÉ EXISTE: Kora tenía check-out pero no check-in, así que la llegada se
// deducía de las fechas y nunca se afirmaba. El hotelero no podía distinguir
// "llega hoy" de "ya está aquí", y una estancia de UNA noche no aparecía nunca
// "En casa" porque ese estado exige `checkin < hoy` estricto.
//
// POST   → el huésped llegó; su cuarto sale OCUPADA en el mapa desde ese momento.
// DELETE → deshacer (se marcó la reserva equivocada).

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return rutaSegura("admin.reservas.checkin.post", async () => {
    const ctx = await getActiveHotel();
    if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
    // Recepción registra llegadas: es su trabajo, no requiere mando.
    const no = negar(ctx, "reservas:escribir");
    if (no) return no;

    const { id } = await params; // folio de confirmación
    if (!zId.safeParse(id).success) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }
    const r = await checkinBooking(ctx.hotelId, id);

    if (!r.ok) {
      const mensaje =
        r.error === "no-encontrada"
          ? "No encontramos esa reserva."
          : r.error === "reserva-sin-valor"
            ? "Esa reserva está cancelada o reembolsada: no hay a quién recibir."
            : r.error === "ya-salio"
              ? "A esa reserva ya se le hizo check-out. Deshaz la salida antes de registrar la llegada."
              : r.error === "falta-columna"
                ? "Falta un paso de instalación: corre sql/kora-checkin-real.sql en Supabase."
                : "No se pudo registrar la llegada. Inténtalo de nuevo.";
      return NextResponse.json(
        {
          error: mensaje,
          ...(r.error === "falta-columna"
            ? { hint: "¿Corriste sql/kora-checkin-real.sql en Supabase?" }
            : {}),
        },
        { status: r.error === "no-encontrada" ? 404 : r.error === "falta-columna" ? 500 : 400 },
      );
    }

    // NO se escribe el estado del cuarto. El mapa lo deriva de `checkin_real` en
    // cada carga, y la ocupación AFIRMADA pisa allí hasta LIMPIEZA y
    // MANTENIMIENTO (ver app/api/admin/room-status/route.ts).
    //
    // La primera versión sí escribía OCUPADA, y estaba mal por dos motivos que
    // sólo se vieron probándolo: (a) pisaba el estado anterior del cuarto —un
    // "Limpieza pendiente" o un "Mantenimiento"— y lo perdía para siempre; y
    // (b) al DESHACER la llegada el cuarto se quedaba OCUPADA sin nadie dentro,
    // porque deshacer no revertía la escritura. Derivándolo, deshacer es exacto.
    return NextResponse.json({
      ok: true,
      cuando: r.cuando,
      habitaciones: r.habitaciones,
    });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return rutaSegura("admin.reservas.checkin.delete", async () => {
    const ctx = await getActiveHotel();
    if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
    const no = negar(ctx, "reservas:escribir");
    if (no) return no;

    const { id } = await params;
    if (!zId.safeParse(id).success) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }
    const ok = await deshacerCheckin(ctx.hotelId, id);
    if (!ok) {
      return NextResponse.json(
        { error: "No se pudo deshacer la llegada. Inténtalo de nuevo." },
        { status: 400 },
      );
    }
    // No hay nada que revertir en el mapa: el check-in nunca escribió el estado
    // del cuarto. Al quitar `checkin_real`, la ocupación vuelve a salir de las
    // fechas y el cuarto recupera el estado que tuviera antes (limpieza,
    // mantenimiento o disponible), intacto.
    return NextResponse.json({ ok: true });
  });
}
