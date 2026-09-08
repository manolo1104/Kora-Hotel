// Los dos correos del saldo del bot: «te queda poco» y «se acabó».
//
// Los manda el propio camino del bot (`app/api/agent/route.ts`, acción
// `log-conv`), no un cron, y por eso llegan en el momento en que pasa: un cron
// diario le avisaría al hotelero de que le quedan 60 mensajes cuando ya lleva
// medio día mudo. Que no se dupliquen lo garantiza `saldo_reclamar_aviso`, que
// reclama la fila ANTES de enviar.
//
// Tono: son correos de dinero a un cliente que paga. Dicen qué pasó, qué deja de
// funcionar y qué hacer, en ese orden, sin alarmismo y sin disculpas largas.

import {
  doc,
  cabecera,
  titulo,
  parrafo,
  caja,
  botonOscuro,
  tablaDatos,
  pieKora,
  respiro,
  esc,
  T as TOK,
} from "./design";
import { PAQUETES, pesos } from "@/lib/saldo/paquetes";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

function urlRecarga(slug: string): string {
  return `${SITE}/panel/${encodeURIComponent(slug)}/camila`;
}

/** La tabla de paquetes, igual en los dos correos. */
function tablaPaquetes(): string {
  return tablaDatos(
    PAQUETES.map((p) => ({
      k: pesos(p.mxn),
      v: `${p.mensajes.toLocaleString("es-MX")} mensajes`,
    })),
  );
}

/**
 * «Te quedan pocos mensajes.» Camila SIGUE contestando: esto es el aviso con
 * tiempo, y por eso no lleva ni rojo ni urgencia.
 */
export function emailSaldoBajo({
  hotel,
  slug,
  mensajes,
  dias,
}: {
  hotel: string;
  slug: string;
  mensajes: number;
  /** Días que le duran al ritmo que lleva; `null` si no hay con qué estimarlo. */
  dias: number | null;
}) {
  const cuanto =
    dias === null
      ? "Camila sigue contestando con normalidad."
      : dias <= 1
        ? "Al ritmo que llevas, se te acaban <strong>hoy o mañana</strong>."
        : `Al ritmo que llevas, te duran unos <strong>${dias} días</strong>.`;

  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Saldo de WhatsApp" }) +
    titulo(`A ${esc(hotel)} le quedan ${mensajes} mensajes`) +
    parrafo(
      `Cada respuesta que Camila le manda a un huésped por WhatsApp descuenta un mensaje de tu saldo. ${cuanto}`,
    ) +
    caja(
      `Cuando el saldo llegue a cero, <strong>Camila deja de contestarle a tus huéspedes</strong> hasta que recargues. Tu página de reservas, tus correos y el resto del panel siguen funcionando igual.`,
      "alerta",
    ) +
    parrafo(`<strong>Recargar toma un minuto:</strong>`) +
    tablaPaquetes() +
    botonOscuro(urlRecarga(slug), "Recargar mi saldo") +
    parrafo(
      `<span style="font-size:13px;color:${TOK.tenue};">Está en tu panel, en la pestaña de Camila. ¿Alguna duda? Responde este correo.</span>`,
    ) +
    respiro +
    pieKora();

  return {
    subject: `A Camila le quedan ${mensajes} mensajes en ${hotel}`,
    html: doc(
      "Te queda poco saldo — Kora",
      `Quedan ${mensajes} mensajes. Cuando lleguen a cero, Camila deja de contestar.`,
      inner,
    ),
  };
}

/** «Se acabó.» Camila ya está callada: aquí sí toca decirlo sin rodeos. */
export function emailSaldoAgotado({ hotel, slug }: { hotel: string; slug: string }) {
  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Saldo agotado" }) +
    titulo(`Camila dejó de contestar en ${esc(hotel)}`) +
    parrafo(
      `Se acabó el saldo de mensajes de WhatsApp. Camila sigue conectada, pero <strong>ya no le está respondiendo a tus huéspedes</strong>: a quien escriba le avisa una vez de que en un momento lo atiende una persona del hotel, y después se queda callada.`,
    ) +
    caja(
      `Lo demás sigue funcionando con normalidad: tu página de reservas, los cobros, los correos automáticos y el panel. Esto sólo afecta a las respuestas de Camila por WhatsApp.`,
      "neutro",
    ) +
    parrafo(`<strong>En cuanto recargues, vuelve a contestar sola.</strong> No hay que reconectar nada:`) +
    tablaPaquetes() +
    botonOscuro(urlRecarga(slug), "Recargar y reactivar a Camila") +
    parrafo(
      `<span style="font-size:13px;color:${TOK.tenue};">Mientras tanto, conviene que alguien esté al pendiente del WhatsApp del hotel. ¿Necesitas ayuda? Responde este correo.</span>`,
    ) +
    respiro +
    pieKora();

  return {
    subject: `Camila dejó de contestar en ${hotel} — se acabó el saldo`,
    html: doc(
      "Se acabó tu saldo — Kora",
      "Camila dejó de responder por WhatsApp. Recargando vuelve sola.",
      inner,
    ),
  };
}
