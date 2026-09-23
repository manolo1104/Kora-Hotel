// El aviso de que los mensajes de Camila se recargan desde el panel (1 oct 2026).
//
// POR QUÉ EXISTE (23 sep 2026): Manolo decidió el modelo nuevo. Camila gasta un
// mensaje por cada respuesta que da —a huéspedes o en el chat de prueba— y
// desde el 1 de octubre se recarga desde la plataforma. Ese mismo día se abren
// las recargas, se regala a todos un colchón de 100 mensajes y se enciende el
// corte: sin saldo, Camila se pausa hasta que recarguen.
//
// Se escribe por lo que le toca hacer a quien lo lee (mirar su saldo y
// recargar), y dice qué NO se toca.
//
// SE SUBE ANTES QUE EL CAMBIO (decisión de Manolo: el modelo nuevo entra el
// 1 oct, el correo sale antes). Por eso los paquetes y el colchón van escritos
// AQUÍ y no se leen de lib/saldo: en producción esos archivos siguen con los
// precios viejos hasta el 1 oct, y el correo anunciaría $100 = 300. Cuando el
// cambio esté arriba, `tests/aviso-recargas.test.ts` exige que coincidan con
// PAQUETES y MENSAJES_SEGURIDAD.
//
// Mismo sistema de diseño que los demás correos (lib/email/design.ts).

import { doc, cabecera, titulo, saludo, parrafo, boton, lista, pieKora, esc } from "@/lib/email/design";
import { UMBRAL_AVISO_BAJO } from "@/lib/saldo/paquetes";
import { WHATSAPP } from "@/lib/contacto";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com").replace(/\/$/, "");

/** Los paquetes que se abren el 1 oct (con IVA). Ver la nota de arriba. */
export const PAQUETES_OCTUBRE = [
  { mxn: 300, mensajes: 500 },
  { mxn: 600, mensajes: 1_050 },
  { mxn: 900, mensajes: 1_800 },
  { mxn: 2_000, mensajes: 4_500 },
] as const;

/** El colchón que se regala a todos el 1 oct, antes de encender el corte. */
export const COLCHON_OCTUBRE = 100;

/** Lleva la fecha dentro: es lo que impide que `email_log` lo deje salir dos veces. */
export const TIPO_AVISO_RECARGAS = "aviso_recargas_camila_2026_10_01";

export function emailAvisoRecargas({ nombre }: { nombre?: string }): { subject: string; html: string } {
  const subject = "Desde el 1 de octubre, los mensajes de Camila se recargan desde tu panel";

  const paquetes = PAQUETES_OCTUBRE.map(
    (p) => `$${p.mxn.toLocaleString("es-MX")} = ${p.mensajes.toLocaleString("es-MX")} mensajes`,
  ).join(" · ");

  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Cambio en tu cuenta" }) +
    titulo(esc("Camila pasa a funcionar con saldo de mensajes")) +
    saludo(
      "Hola",
      (nombre || "").trim() || "qué tal",
      esc(
        "Te escribo para contarte un cambio que empieza el jueves 1 de octubre, y lo que te toca hacer para que Camila siga contestando sin pausa.",
      ),
    ) +
    lista("Cómo va a funcionar", [
      esc(
        "Cada respuesta que da Camila usa un mensaje de tu saldo: las que manda a tus huéspedes por WhatsApp y también las del chat de prueba de tu panel.",
      ),
      esc(
        "Los mensajes de regalo que ya tienes se quedan. Además, el 1 de octubre te regalamos " +
          `${COLCHON_OCTUBRE} mensajes más para que nadie empiece el cambio en ceros.`,
      ),
      esc(
        "Desde ese día puedes recargar desde tu panel, en la pantalla de Camila, con tarjeta. Los paquetes (IVA incluido): " +
          `${paquetes}.`,
      ),
      esc(
        `Cuando te queden ${UMBRAL_AVISO_BAJO} mensajes te avisamos por correo. Si el saldo llega a cero, Camila se pausa hasta que recargues.`,
      ),
    ]) +
    lista("Qué te toca hacer", [
      esc("Entra a tu panel, abre Camila y revisa cuántos mensajes tienes hoy."),
      esc(
        "Si tu hotel recibe muchos mensajes, recarga el 1 de octubre para no llegar a cero en un fin de semana.",
      ),
    ]) +
    parrafo(
      `<strong>${esc("Lo que NO se toca")}:</strong> ${esc(
        "tus reservas, tu calendario, tu página y tu motor de reservas funcionan igual. El saldo sólo cuenta las respuestas de Camila; los mensajes que escribes tú desde tu teléfono no gastan nada.",
      )}`,
    ) +
    boton(`${SITE}/panel`, "Ver mi saldo") +
    // Por WhatsApp y no «contéstame este correo»: hola@kora-hotel.com no tiene
    // buzón (el dominio no tiene MX), así que una respuesta se perdería.
    parrafo(
      `${esc(
        "Si tienes dudas sobre cuántos mensajes usa tu hotel al mes, escríbeme por",
      )} <a href="https://wa.me/${esc(WHATSAPP)}" style="color:inherit;font-weight:600;">WhatsApp</a> ${esc(
        "y lo vemos juntos con tus números.",
      )}`,
      "padding-bottom:8px;",
    ) +
    pieKora("Recibes esto porque tienes un hotel en Kora. Es un aviso de servicio, no publicidad.");

  return {
    subject,
    html: doc(
      subject,
      `Desde el 1 de octubre Camila usa saldo de mensajes y recargas desde tu panel. Te regalamos ${COLCHON_OCTUBRE} para empezar.`,
      inner,
    ),
  };
}
