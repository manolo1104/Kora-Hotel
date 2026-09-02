import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reservaCuenta } from "@/lib/booking/estado-reserva";
import { resolveHotel } from "@/lib/tenant";
import { createAdminClient } from "@/lib/supabase/admin";
import { limitado, ipDe } from "@/lib/api/rate-limit";
import { leerCuerpo } from "@/lib/api/cuerpo";
import { rutaSegura } from "@/lib/api/responder";
import { hoyHotel } from "@/lib/fecha-hotel";
import { apellidoCoincide } from "@/lib/booking/apellido";

export const dynamic = "force-dynamic";

// Encuentra la reserva del huésped que escanea el QR FIJO del mostrador.
//
// El QR de la reserva y el del correo ya traen el uuid; éste no trae nada, así
// que el huésped tiene que identificarse. El listón es el MISMO que ya usa el
// portal del huésped (`/api/reserva/consultar`): folio de alta entropía + un
// dato que sólo él sabe. Aquí el segundo dato es el APELLIDO y no el correo,
// porque delante del mostrador el apellido se teclea sin equivocarse y el correo
// no siempre se recuerda.
//
// Lo que protege esto, en orden de importancia:
//   1. El folio ya son 4 caracteres al azar sobre un alfabeto de 32 DENTRO de
//      este hotel (~1 millón), y hay que acertarlo entero.
//   2. El limitador por IP: 8 intentos cada 10 minutos. Adivinar a ciegas deja
//      de ser viable mucho antes de acercarse.
//   3. Un mensaje ÚNICO para todos los fallos. Decir "el folio existe pero el
//      apellido no coincide" convertiría esto en un oráculo de folios.

const CUERPO = z.object({
  folio: z.string().trim().min(4).max(40),
  apellido: z.string().trim().min(2).max(80),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return rutaSegura("h.preCheckin.buscar", async () => {
    if (await limitado("h.preCheckin.buscar", ipDe(req), { max: 8, ventanaMs: 600_000 })) {
      return NextResponse.json(
        { ok: false, error: "Demasiados intentos. Espera unos minutos o pide ayuda en recepción." },
        { status: 429 },
      );
    }

    const { slug } = await params;
    const hotel = await resolveHotel(slug);
    if (!hotel) return NextResponse.json({ ok: false, error: "hotel-no-encontrado" }, { status: 404 });

    const c = await leerCuerpo(req, CUERPO);
    if (!c.ok) return c.respuesta;

    // UN solo mensaje para todo lo que falle. Es deliberado.
    const noEncontrada = NextResponse.json(
      { ok: false, error: "No encontramos esa reserva. Revisa el folio y tu apellido, o pide ayuda en recepción." },
      { status: 404 },
    );

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("bookings")
      .select("id, cliente, estado, checkout")
      .eq("hotel_id", hotel.id) // ata la búsqueda a ESTE hotel
      .eq("confirmacion", c.datos.folio.toUpperCase())
      .maybeSingle();

    if (error) {
      console.error("[h.preCheckin.buscar]", error.message);
      return NextResponse.json(
        { ok: false, error: "No pudimos buscar tu reserva. Inténtalo de nuevo." },
        { status: 500 },
      );
    }
    if (!data) return noEncontrada;
    if (!reservaCuenta(data.estado)) return noEncontrada;
    if (data.checkout && String(data.checkout) < hoyHotel()) return noEncontrada;

    // El apellido tiene que aparecer en el nombre de la reserva. Se compara por
    // palabras y no con "incluye la cadena": así "Ana" no abre la reserva de
    // "Anacleto", y sigue funcionando si el huésped teclea sólo uno de sus dos
    // apellidos.
    if (!apellidoCoincide(String(data.cliente ?? ""), c.datos.apellido)) return noEncontrada;

    return NextResponse.json({ ok: true, r: data.id });
  });
}
