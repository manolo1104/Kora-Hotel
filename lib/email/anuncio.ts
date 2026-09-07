// El aviso de novedades, en dos versiones del mismo correo.
//
// Nadie pidió un registro de cambios, así que esto se escribe por lo que le
// AHORRA a quien lo lee, no por lo que se programó.
//
// A QUIÉN LE LLEGA cambia el cierre y el pie, y no es un detalle:
//
//  - HOTELERO (sin `token`): es cliente y esto ya está en su panel. Botón a SU
//    panel, y el pie explica que es un aviso de su cuenta. Mandar a un cliente
//    que paga a la página de precios es de las cosas que hacen que dejen de
//    abrirte los correos.
//  - SUSCRIPTOR de la lista de captación (con `token`): todavía no tiene hotel
//    en Kora. Botón a precios, y pie con BAJA DE UN CLIC — eso sí es comercial,
//    y quien envía tiene que añadir además las cabeceras con `cabecerasBaja`.
//
// Todo con las piezas de lib/email/design.ts, como el resto de los 29 correos.

import { doc, cabecera, titulo, saludo, parrafo, boton, lista, pieKora, esc } from "@/lib/email/design";
import { pieConBaja } from "@/lib/email/guia";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com").replace(/\/$/, "");

/** Tipo del anuncio en la bitácora de correos. Cambiarlo = poder reenviarlo. */
export const TIPO_ANUNCIO = "anuncio_bandeja_correos";

export interface DatosAnuncio {
  nombre?: string;
  /**
   * Token de baja del SUSCRIPTOR. Con él, el pie lleva la baja de un clic.
   *
   * Los HOTELEROS no tienen token y no les hace falta: esto no es captación, es
   * un aviso sobre el panel que ya están pagando. Lo que sí necesitan es que el
   * pie diga POR QUÉ les llega, y eso va en los dos casos.
   */
  token?: string;
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
    // El cierre cambia según a quién le llegue, porque el siguiente paso no es
    // el mismo: al hotelero se le manda a SU panel, donde esto ya está; al que
    // sólo descargó la guía, a ver qué es Kora. Mandar a un cliente que ya paga
    // a la página de precios es de las cosas que hacen que dejen de abrirte.
    (token
      ? boton(`${SITE}/precios`, "Ver Kora") +
        parrafo(
          esc("Si ya tienes tu hotel en Kora, todo esto ya está en tu panel: no hay nada que instalar."),
          "padding-bottom:8px;",
        )
      : boton(`${SITE}/panel`, "Abrir mi panel") +
        parrafo(
          esc("Ya está en tu panel: no hay nada que instalar ni que activar. Si algo no te cuadra, contéstame este correo."),
          "padding-bottom:8px;",
        )) +
    (token
      ? pieConBaja(token)
      : pieKora("Recibes esto porque tienes un hotel en Kora. Es un aviso sobre tu panel, no publicidad."));

  return {
    subject,
    html: doc(
      subject,
      "La bandeja de WhatsApp y los correos con la marca de tu hotel, ya en el panel.",
      inner,
    ),
  };
}
