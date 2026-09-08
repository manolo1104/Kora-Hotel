// Cobrar un mensaje de Camila, y avisar cuando se está acabando.
//
// Vive aparte de `app/api/agent/route.ts` para que esa ruta siga siendo un
// router y para poder probar esto sin levantar la API.
//
// ── QUÉ COBRA Y QUÉ NO ───────────────────────────────────────────────────────
//
// Sólo una RESPUESTA DE CAMILA GENERADA POR EL MODELO. Se sabe porque el runtime
// lo dice en positivo (`cobrar: true`, sólo en `agentes/camila/index.js` justo
// detrás del `client.sendMessage` del turno real) y porque el turno que manda es
// `assistant` SIN `por`.
//
// Las dos condiciones se comprueban aquí, y hacen falta las dos. `log-conv`
// tiene tres emisores distintos y sólo uno es «Camila contestó»:
//
//   · el turno real de Camila                    → assistant sin `por`   → COBRA
//   · lo que el hotelero escribe desde su móvil   → assistant `por:"hotel"` → no
//   · el aviso «no puedo leer audios»             → assistant sin `por`   → no,
//     porque ese no manda `cobrar` (no hay llamada al modelo, no cuesta nada)
//
// ── LA DIRECCIÓN DEL FALLO ───────────────────────────────────────────────────
//
// Cobrar de MENOS. Si el runtime es viejo y no manda `cobrar`, si la red se cae,
// si el SQL no está corrido: el mensaje sale gratis. Cobrar por un mensaje que
// quizá no salió es peor que no cobrarlo.

import type { TurnoConversacion } from "@/lib/db/admin";
import { consumirMensaje, reclamarAviso, consumoDelMes, SIN_DATO } from "@/lib/db/saldo";
import { UMBRAL_AVISO_BAJO, diasQueAlcanzan, recargaActiva } from "@/lib/saldo/paquetes";
import { emailSaldoBajo, emailSaldoAgotado } from "@/lib/email/saldo";
import { enviarEmail } from "@/lib/email/resend";
import { resolveHotelAvisoEmail } from "@/lib/email/reserva";
import { alertar } from "@/lib/alertas";

export interface HotelDelCobro {
  id: string;
  slug: string;
  nombre?: string | null;
  owner_id?: string | null;
  extras?: Record<string, unknown> | null;
  config?: Record<string, unknown> | null;
}

/**
 * ¿Este `log-conv` es una respuesta que Camila generó con el modelo?
 *
 * Las dos señales tienen que estar. `cobrar` lo pone el runtime a propósito;
 * la forma del turno se comprueba aquí por si acaso — un runtime con un bug no
 * puede cobrarle a un hotel por un mensaje del huésped.
 */
export function cobrable(cobrar: unknown, turnos: TurnoConversacion[] | undefined): boolean {
  if (cobrar !== true) return false;
  if (!Array.isArray(turnos)) return false;
  return turnos.some(
    (t) => t && t.rol === "assistant" && !t.por && typeof t.texto === "string" && t.texto.trim().length > 0,
  );
}

/**
 * Descuenta el mensaje y, si con eso cruzó un umbral, le escribe al hotelero.
 *
 * Nunca lanza: esto corre justo después de que el huésped YA recibió su
 * respuesta, y ningún fallo de aquí puede convertirse en un error para el bot.
 */
export async function cobrarMensaje(hotel: HotelDelCobro, ref: string): Promise<void> {
  try {
    const quedan = await consumirMensaje(hotel.id, ref);
    if (quedan === SIN_DATO) return; // no hay saldo que cobrar, o no se pudo
    if (quedan > UMBRAL_AVISO_BAJO) return; // todavía va sobrado

    const cual = quedan <= 0 ? "cero" : "bajo";
    // Reclamar ANTES de enviar. Tres mensajes simultáneos del mismo hotel
    // cruzarían el umbral a la vez; sin esto, el hotelero recibe tres correos.
    if (!(await reclamarAviso(hotel.id, cual))) return;

    // MIENTRAS EL PAGO NO ESTÉ ABIERTO, AL HOTELERO NO SE LE ESCRIBE. Los dos
    // correos le dicen «recarga aquí» y ahí todavía no hay dónde: sería mandarlo
    // a una puerta cerrada y preocuparlo por algo que hoy no le corta el
    // servicio. Pero el dato importa —es el consumo real que estamos midiendo—
    // así que se avisa a Kora, no al cliente.
    if (!recargaActiva()) {
      alertar(
        `saldo: ${hotel.slug} llegó a ${quedan} mensajes`,
        `El prepago todavía está en «próximamente», así que NO se le escribió al hotelero. ` +
          `Es consumo real: ${hotel.slug} ya bajó a ${quedan} de sus 300. ` +
          `Antes de encender SALDO_BLOQUEO hay que recargarle.`,
      );
      return;
    }

    const para = await resolveHotelAvisoEmail(hotel);
    if (!para) {
      alertar(
        "saldo: no se pudo avisar al hotelero",
        `El hotel ${hotel.slug} cruzó el umbral de saldo (${quedan} mensajes) y no hay correo al que escribirle.`,
      );
      return;
    }

    const nombre = (hotel.nombre ?? hotel.slug) || hotel.slug;
    const correo =
      cual === "cero"
        ? emailSaldoAgotado({ hotel: nombre, slug: hotel.slug })
        : emailSaldoBajo({
            hotel: nombre,
            slug: hotel.slug,
            mensajes: quedan,
            dias: diasQueAlcanzan(quedan, (await consumoDelMes(hotel.id)).porDia),
          });

    // Con `await`: en Vercel un envío lanzado sin esperar se pierde cuando la
    // función se congela al responder. El huésped ya tiene su respuesta, así que
    // esta espera no se la come nadie.
    const envio = await enviarEmail({ to: para, ...correo });

    // A propósito NO se devuelve la marca atrás si el envío falla, al revés que
    // el cron de dunning. Allí el reintento es mañana; aquí sería en el mensaje
    // siguiente, y con Resend caído eso es un bucle de intentos en el camino del
    // bot. Se deja constancia y el correo de «se acabó» hace de segunda
    // oportunidad.
    if (!envio.ok) {
      alertar(
        "saldo: el aviso al hotelero no salió",
        `Hotel ${hotel.slug}, aviso «${cual}», quedan ${quedan} mensajes. Resend: ${envio.error}`,
      );
    }
  } catch (e) {
    console.error(`[saldo] no se pudo cobrar el mensaje de ${hotel.slug}:`, e);
  }
}
