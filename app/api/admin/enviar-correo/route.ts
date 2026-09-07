import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { negar } from "@/lib/panel/permisos";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { leerCuerpo, zEmail, zTextoCorto } from "@/lib/api/cuerpo";
import { limitado } from "@/lib/api/rate-limit";
import { enviarEmail, resendEnvReady } from "@/lib/email/resend";
import { registrarCorreo, correosDeHuesped } from "@/lib/email/bitacora";
import { brandFromHotel, fromForHotel } from "@/lib/email/marca-hotel";
import { buildCorreoHotelero } from "@/lib/email/hotelero";
import {
  plantillaPorId,
  faltantes,
  ETIQUETA_CAMPO,
  type Plantilla,
  type DatosCorreo,
} from "@/lib/email/plantillas-hotelero";
import { datosDeHuesped } from "@/lib/panel/correo-huesped";
import { getAllBookings } from "@/lib/db/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El correo que el hotelero ESCRIBE a un huésped desde la ficha del cliente.
//
// Una sola ruta hace las dos cosas —ver cómo queda y mandarlo— a propósito: son
// el mismo correo, y tenerlas separadas era garantizar que un día la vista
// previa enseñara una cosa y saliera otra.
//
// EL INTERRUPTOR CAE DEL LADO SEGURO: sólo se manda si `enviar` es literalmente
// `true`. Ausente, `undefined`, `"true"` o cualquier otra cosa devuelve el HTML
// y no sale nada. Es la lección del `Boolean(enabled)` de `bot-status`, donde un
// cuerpo vacío apagaba a Camila y contestaba que todo bien.
//
// Y EL BOTÓN NO ES TEXTO LIBRE: el destino lo arma este archivo a partir del id
// de plantilla y de los datos del hotel. Si viniera en el cuerpo, cualquiera con
// sesión de recepción podría mandar un correo con la marca del hotel y un enlace
// a donde quisiera.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com").replace(/\/$/, "");

const ESQUEMA = z.object({
  email: zEmail.refine((v) => v !== "N/A", "sin correo"),
  nombre: zTextoCorto.optional(),
  plantilla: z.enum(["blanco", "llegada", "como_llegar", "anticipo", "gracias", "cotizacion"]),
  // El texto que el hotelero dejó tras editar el borrador. Si no viene, se usa
  // el de la plantilla tal cual.
  asunto: z.string().trim().max(200).optional(),
  parrafos: z.array(z.string().max(4_000)).max(20).optional(),
  enviar: z.boolean().optional(),
});

/** La URL del botón, según lo que la plantilla pide y lo que el hotel tiene. */
function urlDelCta(
  plantilla: Plantilla,
  d: DatosCorreo,
  brand: { baseUrl?: string; mapsUrl?: string; reviewUrl?: string },
): string | undefined {
  switch (plantilla.cta) {
    case "reserva":
      // La página donde el huésped consulta su reserva con el folio. Sin folio
      // no lleva a ningún lado, así que no se pinta.
      return d.confirmacion ? `${SITE}/reserva/consultar` : undefined;
    case "maps":
      return brand.mapsUrl || undefined;
    case "resena":
      return brand.reviewUrl || undefined;
    case "motor": {
      if (!brand.baseUrl) return undefined;
      const q = new URLSearchParams();
      if (d.checkin) q.set("checkin", d.checkin);
      if (d.checkout) q.set("checkout", d.checkout);
      if (d.huespedes) q.set("adults", String(d.huespedes));
      const cola = q.toString();
      return `${brand.baseUrl.replace(/\/$/, "")}/reservar${cola ? `?${cola}` : ""}`;
    }
    default:
      return undefined;
  }
}

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ ok: false, error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "marketing:enviar");
  if (no) return no;

  const c = await leerCuerpo(req, ESQUEMA);
  if (!c.ok) {
    return NextResponse.json(
      { ok: false, error: "Este cliente no tiene un correo válido, o falta la plantilla." },
      { status: 400 },
    );
  }
  const cuerpo = c.datos;

  const plantilla = plantillaPorId(cuerpo.plantilla);
  if (!plantilla) {
    return NextResponse.json({ ok: false, error: "Esa plantilla no existe." }, { status: 400 });
  }

  const hotel = ctx.hotel;
  const brand = brandFromHotel(hotel);

  // Los datos REALES de este huésped en ESTE hotel. `getAllBookings` ya filtra
  // por hotel_id: el correo del cuerpo sólo sirve para buscar dentro de esa
  // lista, nunca para alcanzar la reserva de otro hotel.
  const bookings = await getAllBookings(ctx.hotelId);
  const datos = datosDeHuesped({
    hotel,
    bookings,
    email: cuerpo.email,
    nombre: cuerpo.nombre,
  });

  const borrador = plantilla.armar(datos);
  const faltan = faltantes(plantilla, datos);

  // El texto lo manda quien escribe; los DATOS y la nota los pone el servidor.
  // Así el hotelero puede decir lo que quiera, pero el total y la política de
  // cancelación siguen saliendo del motor y no de lo que alguien teclee.
  const asunto = (cuerpo.asunto ?? borrador.asunto).trim();
  const parrafos = (cuerpo.parrafos ?? borrador.parrafos).map((p) => p.trim()).filter(Boolean);
  const urlCta = urlDelCta(plantilla, datos, brand);
  const cta = urlCta && plantilla.ctaTexto ? { texto: plantilla.ctaTexto, url: urlCta } : undefined;

  const html = buildCorreoHotelero({
    hotel: brand,
    huesped: datos.huesped || cuerpo.nombre || "",
    titulo: asunto || plantilla.nombre,
    parrafos,
    datos: borrador.datos,
    nota: borrador.nota,
    cta,
  });

  // ── Vista previa: TODO lo que no sea un `true` explícito acaba aquí ──
  if (cuerpo.enviar !== true) {
    return NextResponse.json({
      ok: true,
      modo: "borrador",
      asunto,
      parrafos,
      datos: borrador.datos ?? [],
      nota: borrador.nota ?? "",
      cta: cta ?? null,
      faltan: faltan.map((f) => ETIQUETA_CAMPO[f]),
      html,
      correos: await correosDeHuesped(ctx.hotelId, cuerpo.email),
    });
  }

  // ── A partir de aquí sí sale un correo ──
  if (faltan.length) {
    return NextResponse.json(
      {
        ok: false,
        error: `Para mandar este correo falta ${faltan.map((f) => ETIQUETA_CAMPO[f]).join(", ")}.`,
      },
      { status: 400 },
    );
  }
  if (!asunto || !parrafos.length) {
    return NextResponse.json(
      { ok: false, error: "El correo necesita un asunto y al menos un párrafo." },
      { status: 400 },
    );
  }

  // Tope por HOTEL (no por IP: el panel entero sale por las mismas máquinas de
  // Vercel). 40 en una hora es de sobra para escribir de uno en uno, y ataja el
  // botón con el clic pegado antes de que queme el dominio de correo.
  if (await limitado("correo.manual", ctx.hotelId, { max: 40, ventanaMs: 60 * 60_000 })) {
    return NextResponse.json(
      { ok: false, error: "Has mandado muchos correos seguidos. Espera un rato e intenta de nuevo." },
      { status: 429 },
    );
  }

  if (!resendEnvReady) {
    return NextResponse.json(
      { ok: false, error: "El envío de correo no está configurado (falta RESEND_API_KEY)." },
      { status: 503 },
    );
  }

  // Lo firma el hotel: si el huésped contesta, tiene que llegarle al hotelero y
  // no al buzón de Kora.
  const envio = await enviarEmail({
    to: cuerpo.email,
    subject: asunto,
    html,
    from: fromForHotel(hotel),
    replyTo: brand.email,
  });

  // Queda constancia salga o no: es lo que le permite al hotelero saber que
  // aquel correo no llegó, en vez de enterarse por un reclamo.
  await registrarCorreo({
    hotelId: ctx.hotelId,
    confirmacion: `man-${randomUUID().slice(0, 8)}`,
    tipo: `manual_${plantilla.id}`,
    destino: cuerpo.email,
    resultado: envio,
    asunto,
  });

  if (!envio.ok) {
    console.error("[enviar-correo] no salió el correo:", envio.error);
    return NextResponse.json(
      { ok: false, error: "No se pudo enviar el correo. Revisa la configuración de correo del hotel." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, modo: "enviado", asunto });
}
