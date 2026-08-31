// ¿Por qué este hotel NO tiene a Camila corriendo?
//
// La lista de requisitos vivía SOLO dentro de /api/bots/fleet, y el panel no la
// conocía: cuando un hotel no entraba al fleet, la pantalla de Camila le decía
// «Estamos preparando tu conexión… en cuanto tu bot esté arriba, aquí aparecerá
// el código QR». Es decir, le pedía esperar por algo que dependía de ÉL y que
// nadie le estaba pidiendo. Un hotel dándose de alta se quedaba mirando ese
// mensaje indefinidamente (pasó con un alta real el 31 ago 2026).
//
// Esta función es la MISMA lista que aplica el fleet, en un solo sitio, para que
// no puedan divergir: si un día se añade un requisito, el panel lo explica solo.

export type MotivoSinBot =
  | "sin-publicar"
  | "demo"
  | "bot-apagado"
  | "sin-acceso"
  | "sin-whatsapp";

export interface HotelElegibilidad {
  publicado?: boolean | null;
  whatsapp?: string | null;
  config?: Record<string, unknown> | null;
  extras?: Record<string, unknown> | null;
}

/**
 * Los requisitos que el hotel NO cumple, en el orden en que conviene resolverlos.
 * Vacío = es elegible y Camila debería arrancar sola.
 *
 * `accesoActivo` se pasa desde fuera porque calcularlo consulta la base, y quien
 * llama ya suele tenerlo.
 */
export function motivosSinBot(
  hotel: HotelElegibilidad,
  accesoActivo: boolean,
): MotivoSinBot[] {
  const cfg = (hotel.config ?? {}) as Record<string, unknown>;
  const extras = (hotel.extras ?? {}) as Record<string, unknown>;
  const motivos: MotivoSinBot[] = [];

  if (extras.demo === true) motivos.push("demo");
  if (hotel.publicado === false) motivos.push("sin-publicar");
  if (cfg.bot_enabled === false) motivos.push("bot-apagado");
  if (!accesoActivo) motivos.push("sin-acceso");
  // No bloquea el fleet, pero sin número no hay a qué vincular el QR: se avisa
  // igual, porque es lo siguiente con lo que se va a topar.
  if (!(hotel.whatsapp ?? "").trim()) motivos.push("sin-whatsapp");

  return motivos;
}

/** Qué hacer, en las palabras del hotelero. Sin jerga y con la acción primero. */
export const QUE_HACER: Record<MotivoSinBot, { titulo: string; detalle: string }> = {
  "sin-publicar": {
    titulo: "Publica tu página",
    detalle:
      "Camila arranca cuando tu hotel está publicado. Ve a Mi sitio y activa «Publicada» abajo a la izquierda.",
  },
  "bot-apagado": {
    titulo: "Enciende a Camila",
    detalle: "Está apagada para tu hotel. Actívala aquí mismo, en el interruptor de arriba.",
  },
  "sin-acceso": {
    titulo: "Activa tu plan",
    detalle:
      "Tu prueba terminó o el plan no está activo. Camila vuelve a conectarse en cuanto lo actives.",
  },
  "sin-whatsapp": {
    titulo: "Pon el WhatsApp de tu hotel",
    detalle:
      "Es el número al que se va a vincular Camila. Se llena en Mi sitio → Datos de tu hotel.",
  },
  demo: {
    titulo: "Este es un hotel de demostración",
    detalle: "Los hoteles demo no conectan WhatsApp a propósito.",
  },
};
