// Qué le toca hacer a un hotel recién dado de alta para PROBAR Kora y dejarlo
// listo. Las funciones son PURAS (no consultan base, Stripe ni reloj): la usan
// la lista «Primeros pasos» del Inicio y el paso «Pruébalo» del onboarding.
//
// ⚠️ Pero el MÓDULO es de servidor: importa `decidirModoPrueba` de
// lib/motor/modo-prueba, que arrastra el cliente con la service-role y Stripe.
// Desde un componente de cliente, sólo `import type` (como hacen
// `OnboardingHotelClient` y `PrimerosPasosLista`); un import normal metería
// ese código en el paquete del navegador.
//
// ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────
//
// El 15 sep 2026 la web pasa a decir «regístrate y pruébalo por dentro». Hasta
// ese día la lista del Inicio tenía 9 tareas y las 9 eran de CONFIGURAR: nada
// invitaba a hablar con Camila ni a hacer una reserva de prueba, que es justo lo
// que convence a un hotelero. Y dos casillas mentían:
//
//   • «Sitio publicado» salía SIEMPRE marcada, porque el hotel nace publicado
//     (`app/api/panel/crear-hotel`). Una palomita que nadie ganó infla el avance.
//   • «Cobros conectados» miraba si había `stripe_account_id`, no si la cuenta
//     puede cobrar: un alta de Stripe a medias salía palomeada mientras el
//     dinero seguía cayendo en la cuenta de Kora. Y su enlace mandaba a /pagos a
//     personas del equipo que esa pantalla no deja entrar.
//
// ── LA REGLA ────────────────────────────────────────────────────────────────
//
// Una tarea sólo lleva palomita si su estado se MIDE de forma fiable con lo que
// hay en la base. Si no (la reserva de prueba simulada no deja rastro; la
// vinculación de WhatsApp vive en el runtime de Railway), va como enlace SIN
// palomita (`ok: null`) y no cuenta para el avance. Inventar el estado es peor
// que no darlo: el hotelero dejaría de creerle a toda la lista.

import type { AccesoHotel } from "@/lib/suscripcion";
import type { DiagnosticoHotel } from "@/lib/panel/diagnostico";
import { decidirModoPrueba } from "@/lib/motor/modo-prueba";

/**
 * Qué hace HOY el motor de reservas de este hotel si un huésped paga.
 *
 * - `prueba`: simula el pago y no llega nada a Stripe (hotel en prueba sin
 *   cobros listos, o el hotel de demostración).
 * - `cobra`: cobra de verdad y el dinero llega a la cuenta de Stripe del hotel.
 * - `sin-cobros`: tiene plan (o no se pudo leer la suscripción) pero su cuenta
 *   de Stripe no cobra todavía. Ahí el motor NO simula: el cobro cae en la
 *   cuenta de Kora (`app/api/h/[slug]/checkout`), así que no se le puede invitar
 *   a «hacer una reserva de prueba».
 * - `pausado`: la prueba venció; el motor no recibe reservas hasta activar el plan.
 * - `bloqueado`: Kora pausó la cuenta a mano. Activar el plan NO lo arregla, por
 *   eso va aparte de `pausado`: decirle «activa tu plan» sería mandarlo a pagar
 *   para seguir igual.
 */
export type EstadoMotor = "prueba" | "cobra" | "sin-cobros" | "pausado" | "bloqueado";

export function estadoDelMotor(a: {
  acceso: AccesoHotel;
  cobrosListos: boolean;
  demo: boolean;
}): EstadoMotor {
  // El demo simula por su cuenta (ReservarClient) y nunca caduca.
  if (a.demo) return "prueba";
  if (a.acceso.bloqueado) return "bloqueado";
  if (!a.acceso.activo) return "pausado";
  // La MISMA regla que decide en el motor: si aquí dijera otra cosa, el panel
  // prometería «no se cobra nada» mientras el checkout cobra.
  if (decidirModoPrueba(a)) return "prueba";
  return a.cobrosListos ? "cobra" : "sin-cobros";
}

export interface TareaPrimerosPasos {
  id: string;
  grupo: "probar" | "configurar";
  label: string;
  /** Una línea que explica la tarea o por qué no tiene enlace. */
  detalle?: string;
  /**
   * `true`/`false` = estado MEDIDO. `null` = no se puede medir de forma fiable:
   * se enseña como enlace, sin palomita, y no cuenta para el avance.
   */
  ok: boolean | null;
  /** null = quien mira no puede abrir esa pantalla: la tarea va sin enlace. */
  href: string | null;
  nuevaPestana?: boolean;
  /** Texto del enlace. */
  accion: string;
}

type ItemDiagnostico = Pick<DiagnosticoHotel["habitaciones"], "ok" | "label">;

export interface DatosPrimerosPasos {
  slug: string;
  diagnostico: {
    habitaciones: ItemDiagnostico;
    precios: ItemDiagnostico;
    fotos: ItemDiagnostico;
    amenidades: ItemDiagnostico;
    experiencias: ItemDiagnostico;
    reglas: ItemDiagnostico;
  };
  estadoMotor: EstadoMotor;
  /** `charges_enabled` real de su cuenta de Stripe, no «tiene cuenta». */
  cobrosListos: boolean;
  /** `extras.bot.probadoAt`: el servidor lo marca a las 3 preguntas del chat de prueba. */
  camilaProbada: boolean;
  puedeVerPagos: boolean;
  /** Abre la pantalla de Camila y su chat de prueba. */
  puedeProbarCamila: boolean;
  /** Puede escanear el QR (sólo el dueño). */
  puedeVincular: boolean;
}

export function tareasPrimerosPasos(d: DatosPrimerosPasos): TareaPrimerosPasos[] {
  const base = `/panel/${d.slug}`;
  const sitio = (tab?: string) => `${base}/sitio${tab ? `?tab=${tab}` : ""}`;
  const motor = `/h/${d.slug}/reservar`;
  const tareas: TareaPrimerosPasos[] = [];

  // ── Probar ────────────────────────────────────────────────────────────────
  if (d.puedeProbarCamila) {
    tareas.push({
      id: "camila-chat",
      grupo: "probar",
      label: "Habla con Camila en el chat de prueba",
      detalle: "Pregúntale precios y disponibilidad como si fueras un huésped.",
      ok: d.camilaProbada,
      href: `${base}/camila`,
      accion: "Probar",
    });
  }

  // La reserva de prueba SÓLO se ofrece cuando el motor de verdad simula. Con
  // cobros reales se cobraría a la tarjeta de quien prueba, y sin cobros listos
  // (hotel con plan) el dinero caería en la cuenta de Kora.
  if (d.estadoMotor === "prueba") {
    tareas.push({
      id: "motor",
      grupo: "probar",
      label: "Haz una reserva de prueba en tu motor",
      detalle: "Tu motor está en modo prueba: el pago se simula y no se cobra nada.",
      ok: null,
      href: motor,
      nuevaPestana: true,
      accion: "Abrir mi motor",
    });
  } else if (d.estadoMotor === "cobra" || d.estadoMotor === "sin-cobros") {
    tareas.push({
      id: "motor",
      grupo: "probar",
      label: "Mira tu motor como lo ve tu huésped",
      detalle:
        d.estadoMotor === "cobra"
          ? "Tus cobros son reales: si terminas una reserva, se cobra a la tarjeta que uses."
          : "Recórrelo sin terminar el pago: tus cobros todavía no están conectados.",
      ok: null,
      href: motor,
      nuevaPestana: true,
      accion: "Abrir mi motor",
    });
  }

  if (d.puedeVincular) {
    tareas.push({
      id: "whatsapp",
      grupo: "probar",
      label: "Vincula tu WhatsApp",
      detalle: "Escanea el código QR en la pantalla de Camila para que conteste a tus huéspedes.",
      ok: null,
      href: `${base}/camila`,
      accion: "Vincular",
    });
  }

  // ── Configurar ────────────────────────────────────────────────────────────
  const conf = (
    id: string,
    item: ItemDiagnostico,
    href: string,
  ): TareaPrimerosPasos => ({ id, grupo: "configurar", label: item.label, ok: item.ok, href, accion: "Completar" });

  tareas.push(
    conf("habitaciones", d.diagnostico.habitaciones, sitio("habitaciones")),
    conf("precios", d.diagnostico.precios, sitio("habitaciones")),
    conf("fotos", d.diagnostico.fotos, sitio("contenido")),
    conf("amenidades", d.diagnostico.amenidades, sitio("contenido")),
    conf("experiencias", d.diagnostico.experiencias, sitio("avanzado")),
    conf("reglas", d.diagnostico.reglas, sitio("avanzado")),
  );

  tareas.push({
    id: "cobros",
    grupo: "configurar",
    label: "Cobros conectados (Stripe)",
    detalle: d.puedeVerPagos
      ? d.cobrosListos
        ? undefined
        : "Para que el dinero de cada reserva llegue directo a tu cuenta."
      : d.cobrosListos
        ? undefined
        : "Solo el dueño del hotel puede conectarlos.",
    ok: d.cobrosListos,
    href: d.puedeVerPagos ? `${base}/pagos` : null,
    accion: "Conectar",
  });

  // «Sitio publicado» ya NO es una tarea: el hotel nace publicado y la casilla
  // salía marcada sin que nadie hiciera nada. Si alguien lo despublica, el aviso
  // lo da el Inicio aparte (ver `PrimerosPasos`).
  return tareas;
}

/** Avance contando SÓLO las tareas cuyo estado se mide. */
export function progresoPrimerosPasos(tareas: readonly TareaPrimerosPasos[]): {
  hechas: number;
  total: number;
  completo: boolean;
} {
  const medibles = tareas.filter((t) => t.ok !== null);
  const hechas = medibles.filter((t) => t.ok === true).length;
  return { hechas, total: medibles.length, completo: hechas === medibles.length };
}
