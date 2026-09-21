// El aviso de mantenimiento de Camila (WhatsApp) a los hoteleros.
//
// POR QUÉ EXISTE (21 sep 2026): el servidor donde vive Camila llegó a su tope de
// procesos —1.001 de 1.000— y con eso dejó de poder abrir el navegador de un
// segundo hotel. El hotel que paga se quedó sin bot y con su sesión de WhatsApp
// liberada. La solución inmediata es reiniciar el servicio, y reiniciar puede
// obligar a algún hotel a volver a escanear su QR: por eso se avisa ANTES, no
// después.
//
// Se escribe por lo que le toca hacer a quien lo lee, no por lo que pasó por
// dentro. El detalle técnico sobra: lo único accionable es «mira la pastilla de
// tu panel y, si dice que no está conectada, vuelve a escanear el QR».
//
// Mismo sistema de diseño que los demás correos (lib/email/design.ts).

import { doc, cabecera, titulo, saludo, parrafo, boton, lista, pieKora, esc } from "@/lib/email/design";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com").replace(/\/$/, "");

/**
 * Tipo en la bitácora de correos. Lleva la fecha dentro A PROPÓSITO: el índice
 * único de `email_log` es (hotel, confirmación, tipo), así que este nombre es lo
 * que impide mandarlo dos veces — y el día que haya otro mantenimiento, se
 * cambia la fecha y ese sí sale.
 */
export const TIPO_AVISO_CAMILA = "aviso_camila_mantenimiento_2026_09_21";

export function emailAvisoCamila({ nombre }: { nombre?: string }): { subject: string; html: string } {
  const subject = "Mantenimiento de Camila hoy: revisa que siga conectada";

  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Aviso de servicio" }) +
    titulo(esc("Hoy reiniciamos el WhatsApp de Camila")) +
    saludo(
      "Hola",
      (nombre || "").trim() || "qué tal",
      esc(
        "Te aviso antes de hacerlo, porque hay una cosa que quizá tengas que hacer tú después: volver a conectar tu WhatsApp.",
      ),
    ) +
    parrafo(
      esc(
        "El servidor donde corre Camila se quedó sin espacio para atender a todos los hoteles a la vez, y eso dejó a uno sin bot. Lo reiniciamos hoy para liberarlo. Tarda unos segundos.",
      ),
    ) +
    lista("Qué tienes que hacer", [
      esc(
        "Después del reinicio, entra a tu panel y abre Camila. Arriba verás si está Conectada.",
      ),
      esc(
        "Si dice «Sin conectar» o te muestra un código QR, escanéalo con el WhatsApp de tu hotel: Ajustes → Dispositivos vinculados → Vincular un dispositivo.",
      ),
      esc(
        "Dale unos cinco minutos antes de preocuparte: el sistema revisa a todos los hoteles cada pocos minutos y muchas veces se reconecta solo.",
      ),
    ]) +
    parrafo(
      `<strong>${esc("Lo que NO se toca")}:</strong> ${esc(
        "tus reservas, tu calendario, tu página y tu motor de reservas siguen funcionando igual durante todo el mantenimiento. Tampoco se borra ninguna conversación: lo único que puede pedirse otra vez es la vinculación del WhatsApp.",
      )}`,
    ) +
    parrafo(
      esc(
        "Y si todavía no habías conectado tu WhatsApp, este es buen momento: son dos minutos y es el mismo paso.",
      ),
    ) +
    boton(`${SITE}/panel`, "Abrir mi panel") +
    parrafo(
      esc(
        "Si después del reinicio Camila no vuelve, contéstame este correo o escríbeme por WhatsApp y lo reviso contigo.",
      ),
      "padding-bottom:8px;",
    ) +
    pieKora("Recibes esto porque tienes un hotel en Kora. Es un aviso de servicio, no publicidad.");

  return {
    subject,
    html: doc(
      subject,
      "Reiniciamos el servicio de WhatsApp. Revisa en tu panel que Camila siga conectada.",
      inner,
    ),
  };
}
