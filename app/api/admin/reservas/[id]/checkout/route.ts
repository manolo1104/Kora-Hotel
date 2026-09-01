import { negar } from "@/lib/panel/permisos";
import { rutaSegura } from "@/lib/api/responder";
import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { checkoutBooking, deshacerCheckout, setRoomStatus } from "@/lib/db/admin";
import { zId } from "@/lib/api/cuerpo";

export const dynamic = "force-dynamic";

// Check-out de una reserva.
//
// POR QUÉ EXISTE: un hotelero probando Kora registró una reserva, vio el cuarto
// en "Ocupada" y no encontró cómo hacerle check-out. No lo encontró porque no
// existía: la ocupación salía SÓLO de las fechas, así que el cuarto seguía
// ocupado hasta que la fecha de salida pasaba sola, y cambiar el estado a mano
// en el mapa no servía porque la ocupación derivada lo volvía a pisar.
//
// POST   → el huésped salió; el cuarto queda libre y pasa a LIMPIEZA.
// DELETE → deshacer (fue un error, el huésped no se había ido).

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return rutaSegura("admin.reservas.checkout.post", async () => {
    const ctx = await getActiveHotel();
    if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
    // Recepción hace check-out: es su trabajo, no requiere mando.
    const no = negar(ctx, "reservas:escribir");
    if (no) return no;

    const { id } = await params; // folio de confirmación
    if (!zId.safeParse(id).success) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }
    const r = await checkoutBooking(ctx.hotelId, id);

    if (!r.ok) {
      const mensaje =
        r.error === "no-encontrada"
          ? "No encontramos esa reserva."
          : r.error === "reserva-sin-valor"
            ? "Esa reserva está cancelada o reembolsada: no ocupa ninguna habitación."
            : "No se pudo registrar el check-out. Inténtalo de nuevo.";
      return NextResponse.json(
        { error: mensaje },
        { status: r.error === "no-encontrada" ? 404 : 400 },
      );
    }

    // El cuarto que se desocupa pasa a LIMPIEZA, no a DISPONIBLE: entre que sale
    // el huésped y entra el siguiente hay que hacerlo. Así aparece solo en la
    // lista de la camarista sin que nadie lo capture.
    //
    // Best-effort a propósito: si esto falla, el check-out YA está hecho y el
    // cuarto YA está libre. Perder el aviso de limpieza no puede tumbar la
    // operación ni hacer que el hotelero repita el check-out.
    const limpieza = await Promise.allSettled(
      r.habitaciones.map((suite) =>
        setRoomStatus(ctx.hotelId, suite, "LIMPIEZA", "Salida registrada — pendiente de limpieza"),
      ),
    );
    const fallidas = limpieza.filter((x) => x.status === "rejected").length;
    if (fallidas) {
      console.error(
        `[admin.reservas.checkout] check-out ok pero ${fallidas} cuarto(s) no pasaron a LIMPIEZA (folio ${id})`,
      );
    }

    return NextResponse.json({
      ok: true,
      cuando: r.cuando,
      habitaciones: r.habitaciones,
      limpiezaPendiente: fallidas === 0,
    });
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return rutaSegura("admin.reservas.checkout.delete", async () => {
    const ctx = await getActiveHotel();
    if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
    const no = negar(ctx, "reservas:escribir");
    if (no) return no;

    const { id } = await params;
    if (!zId.safeParse(id).success) {
      return NextResponse.json({ error: "Identificador inválido." }, { status: 400 });
    }
    const ok = await deshacerCheckout(ctx.hotelId, id);
    if (!ok) {
      return NextResponse.json(
        { error: "No se pudo deshacer el check-out. Inténtalo de nuevo." },
        { status: 400 },
      );
    }
    // El cuarto NO se devuelve a OCUPADA a mano: al quitar `checkout_real`, la
    // ocupación derivada de las fechas vuelve a marcarlo sola.
    return NextResponse.json({ ok: true });
  });
}
