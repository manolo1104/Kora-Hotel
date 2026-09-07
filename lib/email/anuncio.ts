// El correo de novedades a la lista de Kora.
//
// La lista son hoteleros que descargaron la guía. No pidieron un registro de
// cambios: pidieron ayuda para llenar su hotel. Así que esto se escribe por lo
// que les AHORRA, no por lo que se programó, y se manda de tarde en tarde.
//
// Lleva baja de un clic (cabecera `List-Unsubscribe` y enlace visible en el pie)
// porque es correo comercial, no transaccional. `pieConBaja` de lib/email/guia.ts
// ya pone el enlace; las cabeceras las pone quien envía, con `cabecerasBaja`.
//
// Todo con las piezas de lib/email/design.ts, como el resto de los 29 correos.

import { doc, cabecera, titulo, saludo, parrafo, boton, lista, esc } from "@/lib/email/design";
import { pieConBaja } from "@/lib/email/guia";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com").replace(/\/$/, "");

/** Tipo del anuncio en `suscriptor_email_log`. Cambiar = poder reenviar. */
export const TIPO_ANUNCIO = "anuncio_bandeja_correos";

export interface DatosAnuncio {
  nombre?: string;
  /** Token de baja del suscriptor. Sin él NO se manda: sería correo sin salida. */
  token: string;
}

export function emailAnuncio({ nombre, token }: DatosAnuncio): { subject: string; html: string } {
  const subject = "Ahora puedes contestar los WhatsApp de tus huéspedes desde Kora";

  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Novedades" }) +
    titulo(esc("Dos cosas nuevas, y las dos te ahorran salir del panel")) +
    saludo(
      "Hola",
      (nombre || "").trim() || "qué tal",
      esc(
        "Te escribo porque estas dos son de las que se notan el mismo día, no de las que hay que aprenderse.",
      ),
    ) +
    parrafo(
      `<strong>1. La bandeja de WhatsApp.</strong> ${esc(
        "Hasta ahora podías leer lo que el bot les contestaba a tus huéspedes. Ahora puedes contestar tú, desde el panel, por el WhatsApp de tu hotel. Cuando escribes, el bot se calla dos horas en ese chat para no hablar encima de ti. Y puedes etiquetar cada conversación —cotizando, reservó, perdida— para saber cuáles siguen vivas.",
      )}`,
    ) +
    parrafo(
      `<strong>2. Correos a tus huéspedes, con la marca de tu hotel.</strong> ${esc(
        "Desde la ficha de cada cliente, con cinco plantillas ya rellenadas con sus datos reales: sus fechas, su habitación, lo que pagó y lo que debe. Editas lo que quieras y lo mandas. Se acabó el copiar y pegar en Gmail.",
      )}`,
    ) +
    lista("Y de paso, el bot aprendió tres cosas", [
      esc("Ahora sabe quién le escribe: si ya se hospedó, qué reservó y lo que le falta pagar."),
      esc("Reconoce los códigos de descuento que tú diste de alta, en vez de decir que no sabe nada."),
      esc("Sabe explicar por qué el precio cambia el fin de semana."),
    ]) +
    parrafo(
      esc(
        "Si corriges una respuesta suya desde la bandeja, se la aprende para la siguiente. Esa es la parte que más va a cambiar con el uso.",
      ),
    ) +
    boton(`${SITE}/precios`, "Ver Kora") +
    parrafo(
      esc(
        "Si ya tienes tu hotel en Kora, todo esto ya está en tu panel: no hay nada que instalar ni que activar.",
      ),
      "padding-bottom:8px;",
    ) +
    pieConBaja(token);

  return {
    subject,
    html: doc(
      subject,
      "La bandeja de WhatsApp y los correos con la marca de tu hotel, ya en el panel.",
      inner,
    ),
  };
}
