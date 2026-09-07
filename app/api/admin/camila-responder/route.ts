import { NextResponse } from "next/server";
import { z } from "zod";
import { negar } from "@/lib/panel/permisos";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { leerCuerpo } from "@/lib/api/cuerpo";
import { limitado } from "@/lib/api/rate-limit";
import { postAlRuntime, MENSAJE_FALLO } from "@/lib/bot/runtime";
import { getHiloCamila, logCamilaConversacion, guardarEstadoChat } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

// Contestarle a un huésped por WhatsApp desde la bandeja del panel.
//
// El camino es: panel → esta ruta (Vercel) → runtime de Camila (Railway) →
// WhatsApp. Kora no tiene ninguna sesión de WhatsApp propia; el único que puede
// mandar es el proceso que tiene el Chromium abierto.
//
// TRES CANDADOS, y ninguno sobra:
//
// 1. `bot:responder` — escribir por el WhatsApp del hotel es hablar EN NOMBRE
//    del hotel, así que va con el permiso de mando, igual que leerlas.
// 2. El hilo tiene que EXISTIR en este hotel. No es un formalismo: es lo que
//    impide que alguien con sesión de un hotel mande un WhatsApp a un número
//    cualquiera usando el número de ese hotel. La bandeja contesta
//    conversaciones que ya existen; no inicia conversaciones nuevas.
// 3. Tope por hotel, para que un botón con el clic pegado no dispare una
//    ráfaga desde un número real de WhatsApp (que es como se gana un baneo).

/** Cuánto calla Camila por defecto cuando contesta una persona. */
const PAUSA_POR_DEFECTO_MIN = 120;

const ESQUEMA = z.object({
  chatId: z.string().trim().min(1).max(80),
  texto: z.string().trim().min(1).max(3_000),
  /** 0 = no pausar a Camila. Por defecto, dos horas. */
  pausarMin: z.number().int().min(0).max(1440).optional(),
});

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ ok: false, error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "bot:responder");
  if (no) return no;

  const c = await leerCuerpo(req, ESQUEMA);
  if (!c.ok) return NextResponse.json({ ok: false, error: "Falta el mensaje." }, { status: 400 });
  const { chatId, texto } = c.datos;
  const pausarMin = c.datos.pausarMin ?? PAUSA_POR_DEFECTO_MIN;

  // Grupos y difusión no: el runtime tampoco los atiende, y mandar ahí con el
  // número del hotel no es contestarle a un huésped.
  if (chatId.endsWith("@g.us") || chatId.endsWith("@broadcast")) {
    return NextResponse.json({ ok: false, error: "Ese chat no es de un huésped." }, { status: 400 });
  }

  // El hilo, buscado SIEMPRE por el hotel de la sesión.
  const hilo = await getHiloCamila(ctx.hotelId, chatId);
  if (!hilo) {
    return NextResponse.json(
      { ok: false, error: "Esa conversación no existe en tu hotel." },
      { status: 404 },
    );
  }

  if (await limitado("camila.responder", ctx.hotelId, { max: 120, ventanaMs: 10 * 60_000 })) {
    return NextResponse.json(
      { ok: false, error: "Vas muy rápido. Espera un momento antes de mandar otro mensaje." },
      { status: 429 },
    );
  }

  const envio = await postAlRuntime("/enviar", { slug: ctx.hotel.slug, chatId, texto });
  if (!envio.ok) {
    console.error(`[camila-responder] ${ctx.hotel.slug} → ${envio.fallo}`, envio.detalle ?? "");
    return NextResponse.json(
      { ok: false, error: MENSAJE_FALLO[envio.fallo] },
      { status: envio.fallo === "hotel-sin-sesion" ? 409 : 502 },
    );
  }

  // Ya salió. A partir de aquí NADA puede devolver un error: el mensaje está en
  // el teléfono del huésped, y decirle al hotelero que falló le haría mandarlo
  // dos veces. Lo que quede a medias se registra y se sigue.
  const ahora = new Date();
  const pausadoHasta = pausarMin > 0 ? new Date(ahora.getTime() + pausarMin * 60_000).toISOString() : null;

  // Queda en el hilo como turno del asistente, con `por:"hotel"`. Con rol
  // `assistant` a propósito: al rehidratar el historial, Camila tiene que ver
  // esta respuesta como suya para no contradecirla en el mensaje siguiente.
  await logCamilaConversacion(ctx.hotelId, chatId, [
    { rol: "assistant", texto, ts: ahora.toISOString(), por: "hotel" },
  ]);

  const guardada = await guardarEstadoChat(ctx.hotelId, chatId, {
    pausadoHasta,
    vistoAt: ahora.toISOString(),
  });

  // Y se le avisa al runtime para que la pausa surta efecto YA, sin esperar a
  // que expire su caché. Mejor esfuerzo —la fuente de verdad es la base, que él
  // consulta igualmente—, pero si falla se DICE: significa que durante un minuto
  // Camila puede contestar encima del hotelero, y eso hay que poder verlo en los
  // registros cuando pase.
  if (pausadoHasta) {
    const avisado = await postAlRuntime("/pausa", { slug: ctx.hotel.slug, chatId, hasta: pausadoHasta });
    if (!avisado.ok) console.warn(`[camila-responder] pausa no avisada al runtime: ${avisado.fallo}`);
  }

  return NextResponse.json({
    ok: true,
    pausadoHasta,
    // Si la pausa no se pudo guardar (el SQL de la bandeja sin correr), se dice:
    // el mensaje salió, pero Camila puede volver a contestar encima.
    avisoPausa: pausadoHasta && !guardada ? "El mensaje salió, pero no pude pausar a Camila en este chat." : null,
  });
}
