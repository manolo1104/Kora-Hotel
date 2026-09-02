import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { reservaCuenta } from "@/lib/booking/estado-reserva";
import { resolveHotel } from "@/lib/tenant";
import { getBooking } from "@/lib/db/bookings";
import { guardarPreCheckin, type OrigenPreCheckin } from "@/lib/db/pre-checkin";
import { limitado, ipDe } from "@/lib/api/rate-limit";
import { leerCuerpo } from "@/lib/api/cuerpo";
import { rutaSegura } from "@/lib/api/responder";

export const dynamic = "force-dynamic";

// Pre check-in: el huésped se registra desde su celular antes de llegar.
//
// LA VERIFICACIÓN es la misma que ya usa la captura de reseñas: `r` es el id
// (uuid v4) de una reserva real de ESTE hotel — inadivinable, y viaja en el
// mismo correo que ya lleva su folio. No hay cuenta ni contraseña porque el
// huésped no tiene ninguna.
//
// LO QUE ESO IMPLICA, dicho claro: quien tenga el enlace puede llenar el
// formulario. Es proporcionado porque aquí NO se suben identificaciones (ver
// lib/db/pre-checkin.ts) y porque lo peor que consigue un intruso es dejar mal
// escrito un registro que recepción coteja con el documento del huésped al
// entregarle la llave. Si algún día se guardan fotos de identificación, esto
// tiene que pasar a un token revocable con caducidad.

/** Un acompañante. El nombre es lo único que hace falta. */
const ACOMPANANTE = z.object({
  nombre: z.string().trim().min(1).max(120),
  edad: z.coerce.number().int().min(0).max(120).optional(),
});

// La firma es un PNG en data-URI dibujado con el dedo. Un lienzo de 600×200 pesa
// unos 10-20 KB; el tope de 300 KB deja margen de sobra para una pantalla grande
// y corta de raíz que alguien empuje una imagen por este campo.
const FIRMA_MAX = 300_000;

const CUERPO = z.object({
  r: z.string().uuid("Enlace inválido."),
  nombreCompleto: z.string().trim().min(2).max(160),
  telefono: z.string().trim().max(40).optional(),
  email: z.string().trim().max(160).optional(),
  domicilio: z.string().trim().max(300).optional(),
  ciudadOrigen: z.string().trim().max(120).optional(),
  pais: z.string().trim().max(80).optional(),
  documentoTipo: z.enum(["INE", "Pasaporte", "Licencia", "Otro"]).optional(),
  // Sólo los últimos dígitos. El campo es corto A PROPÓSITO: no cabe un número
  // completo, y así el formulario no invita a teclearlo.
  documentoRef: z.string().trim().max(8).optional(),
  acompanantes: z.array(ACOMPANANTE).max(20).optional(),
  horaEstimada: z.string().trim().max(20).optional(),
  placas: z.string().trim().max(20).optional(),
  firma: z
    .string()
    .max(FIRMA_MAX, "La firma es demasiado grande.")
    .refine((v) => v === "" || /^data:image\/png;base64,/.test(v), "Firma inválida.")
    .optional(),
  aceptaReglamento: z.boolean(),
  aceptaPrivacidad: z.boolean(),
  origen: z.enum(["correo", "qr_reserva", "qr_mostrador", "recepcion"]).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return rutaSegura("h.preCheckin.post", async () => {
    // El limitador va PRIMERO: antes de tocar la base y antes de decir si el
    // hotel existe. Es la puerta, no el segundo filtro.
    if (await limitado("h.preCheckin", ipDe(req), { max: 12, ventanaMs: 600_000 })) {
      return NextResponse.json(
        { ok: false, error: "Demasiados intentos. Espera unos minutos." },
        { status: 429 },
      );
    }

    const { slug } = await params;
    const hotel = await resolveHotel(slug);
    if (!hotel) return NextResponse.json({ ok: false, error: "hotel-no-encontrado" }, { status: 404 });

    const c = await leerCuerpo(req, CUERPO);
    if (!c.ok) return c.respuesta;
    const d = c.datos;

    if (!d.aceptaPrivacidad) {
      return NextResponse.json(
        { ok: false, error: "Hace falta aceptar el aviso de privacidad para registrarte." },
        { status: 400 },
      );
    }

    // La reserva tiene que existir y ser de ESTE hotel. El `hotel.id` es lo que
    // ata el uuid al inquilino: sin él, un id de otro hotel entraría aquí.
    const booking = (await getBooking(hotel.id, d.r)) as
      | { id: string; estado: string | null; checkout: string | null }
      | null;

    // Mensaje ÚNICO para "no existe" y "no es de este hotel": decir cuál de las
    // dos es le confirmaría a alguien que un uuid existe.
    const noSirve = NextResponse.json(
      { ok: false, error: "Este enlace ya no es válido. Escríbenos y te ayudamos." },
      { status: 404 },
    );
    if (!booking) return noSirve;
    if (!reservaCuenta(booking.estado)) return noSirve;
    // Una estancia ya terminada no tiene pre check-in que hacer.
    if (booking.checkout && booking.checkout < new Date().toISOString().slice(0, 10)) return noSirve;

    const res = await guardarPreCheckin(hotel.id, booking.id, {
      nombreCompleto: d.nombreCompleto,
      telefono: d.telefono,
      email: d.email,
      domicilio: d.domicilio,
      ciudadOrigen: d.ciudadOrigen,
      pais: d.pais,
      documentoTipo: d.documentoTipo,
      documentoRef: d.documentoRef,
      acompanantes: d.acompanantes,
      horaEstimada: d.horaEstimada,
      placas: d.placas,
      firma: d.firma,
      aceptaReglamento: d.aceptaReglamento,
      aceptaPrivacidad: d.aceptaPrivacidad,
      origen: (d.origen ?? "correo") as OrigenPreCheckin,
      ip: ipDe(req),
    });

    if (!res.ok) {
      const mensaje =
        res.error === "falta-tabla"
          ? "El hotel aún no tiene activado el registro en línea. Escríbenos y te ayudamos."
          : "No pudimos guardar tu registro. Inténtalo de nuevo.";
      return NextResponse.json({ ok: false, error: mensaje }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  });
}
