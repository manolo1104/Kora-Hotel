// Las reglas de los botones de la ficha de hotel del CRM, PURAS: sin base, sin
// Stripe, sin reloj (el «ahora» se pasa). Se usan en dos sitios:
//
//   · la API (`app/api/crm/hoteles/[slug]/route.ts`), que es la que decide;
//   · la ficha (`components/crm/FichaHotel.tsx`), para apagar de antemano un
//     botón que la API va a rechazar y para enseñar «hasta cuándo le llega» antes
//     de confirmar.
//
// Por eso este archivo NO importa nada que toque la service-role ni Stripe (sólo
// `import type`): lo carga el navegador. Si alguna regla necesita un dato de la
// base, se le pasa ya leído.
//
// Que las dos pantallas usen la MISMA función es lo que evita el botón que dice
// «Dar cortesía» y la API que contesta «no se puede»: pasaba con el bloqueo, que
// validaba el mensaje en el cliente y en el servidor con reglas copiadas a mano.

import type { EstadoSuscripcion } from "@/lib/suscripcion";
import type { SituacionHotel } from "@/lib/crm/operaciones";

export const DIA_MS = 86_400_000;

/** Los días que se pueden regalar de un clic. Fijos: un campo libre acepta «300» por «30». */
export const DIAS_EXTENSION = [7, 14, 30] as const;
export type DiasExtension = (typeof DIAS_EXTENSION)[number];

/**
 * Tope de días extra por dueño. Es el MISMO número que el CHECK de
 * `pruebas.dias_extra` y que `DIAS_EXTRA_MAX` de lib/db/prueba-dueno.ts; no se
 * importa de ahí porque ese archivo usa la service-role y este lo carga el
 * navegador (tests/crm-acciones.test.ts vigila que sigan iguales).
 */
export const DIAS_EXTRA_TOPE = 365;

/** Tope de mensajes por regalo. Una red contra un cero de más, no una política. */
export const MENSAJES_REGALO_MAX = 5000;

export const MOTIVO_MIN = 3;
export const MOTIVO_MAX = 500;
export const MENSAJE_BLOQUEO_MAX = 500;

/**
 * El `ref` de un regalo de saldo: `crm:<uuid>`. Lo genera el NAVEGADOR al abrir
 * el diálogo y lo reenvía igual en cada reintento. `saldo_acreditar` no acredita
 * dos veces el mismo `ref` por hotel, así que un doble clic o un reintento tras
 * un corte de red no regalan dos veces. Si el `ref` se generara en el servidor,
 * cada petición traería uno nuevo y esa red no serviría de nada.
 */
export const REF_REGALO = /^crm:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Veredicto = { ok: true } | { ok: false; motivo: string };

const SI: Veredicto = { ok: true };
const no = (motivo: string): Veredicto => ({ ok: false, motivo });

/** Lo mínimo de `suscripciones` que necesitan las reglas. */
export interface SuscripcionMinima {
  estado: EstadoSuscripcion;
  stripe_subscription_id: string | null;
}

// ─── Textos que se validan igual en los dos lados ────────────────────────────

/** El motivo, limpio, o null si no vale (vacío, muy corto o muy largo). */
export function motivoValido(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= MOTIVO_MIN && t.length <= MOTIVO_MAX ? t : null;
}

export function refRegaloValido(v: unknown): v is string {
  return typeof v === "string" && REF_REGALO.test(v);
}

export function mensajesRegaloValidos(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MENSAJES_REGALO_MAX;
}

// ─── Cortesía ────────────────────────────────────────────────────────────────

/**
 * ¿Este dueño le paga a Kora con una suscripción de Stripe viva?
 *
 * `activa` o `pago_vencido` CON `stripe_subscription_id`. Sin el id no hay nada
 * que Stripe vaya a cobrar (una fila puesta a mano), así que no cuenta.
 * Ojo: el webhook guarda como `activa` a quien está en la prueba de Stripe
 * (`trialing`); para esta regla da igual, porque su tarjeta ya está puesta y
 * Stripe le va a cobrar.
 */
export function pagaConStripe(sub: SuscripcionMinima | null): boolean {
  if (!sub) return false;
  return (sub.estado === "activa" || sub.estado === "pago_vencido") && Boolean(sub.stripe_subscription_id);
}

/**
 * Dar cortesía se RECHAZA a quien paga de verdad: si se le pisara la fila con
 * `cortesia`, Stripe le seguiría cobrando cada mes y el CRM diría que es
 * cortesía. Primero se cancela su suscripción (desde Stripe), luego se regala.
 */
export function puedeDarCortesia(sub: SuscripcionMinima | null): Veredicto {
  if (sub?.estado === "cortesia") return no("Ya tiene cortesía.");
  if (pagaConStripe(sub)) {
    return no(
      "Este dueño paga su plan con Stripe. Si le das cortesía, Stripe le sigue cobrando. Primero cancela su suscripción en Stripe y después vuelve aquí.",
    );
  }
  return SI;
}

/** Sólo se quita lo que es cortesía: nunca se cancela desde aquí un plan pagado. */
export function puedeQuitarCortesia(sub: SuscripcionMinima | null): Veredicto {
  if (sub?.estado !== "cortesia") return no("Este dueño no tiene cortesía.");
  return SI;
}

// ─── Prueba ──────────────────────────────────────────────────────────────────

/**
 * ¿Tiene sentido alargarle la prueba?
 *
 * `planActivo` es `tienePlanActivo(sub)` (lib/suscripcion.ts), calculado por
 * quien llama: a quien tiene plan o cortesía la prueba no le aplica y regalarle
 * días no cambiaría nada hoy, pero sí el día que cancele, sin que nadie se
 * acuerde de por qué su prueba dura de más.
 */
export function puedeExtenderPrueba(a: {
  planActivo: boolean;
  estado: EstadoSuscripcion | null;
  demo: boolean;
}): Veredicto {
  if (a.demo) return no("Es un hotel demo: su prueba no caduca.");
  if (a.planActivo) {
    return no(
      a.estado === "cortesia"
        ? "Tiene cortesía: la prueba no le aplica."
        : "Tiene un plan activo: la prueba no le aplica.",
    );
  }
  return SI;
}

/** Días extra utilizables: enteros de 0 al tope. Lo raro vale 0. */
export function diasExtraSanos(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(DIAS_EXTRA_TOPE, Math.floor(n));
}

export type Extension =
  | { ok: true; diasExtra: number; nuevoFinMs: number }
  | { ok: false; motivo: string };

/**
 * Cuántos días extra hay que GUARDAR para que la prueba llegue a
 * `max(hoy, fin actual) + dias`.
 *
 * `finBaseMs` es el fin SIN días extra: `finDePrueba(inicio, 0)` de
 * lib/suscripcion.ts. Se pide ya calculado para no copiar aquí la regla de 30/14
 * días (y porque ese archivo es de servidor).
 *
 * Por qué `max(hoy, fin actual)` y no «fin actual + dias» a secas: los días extra
 * se suman al FINAL, así que a una prueba vencida hace 20 días, +7 la dejaría
 * vencida todavía. Lo que Manolo quiere decir con «dale una semana» es una
 * semana desde hoy.
 *
 * Con la prueba vigente la cuenta es exacta (tenía N, ahora N + dias). Con la
 * vencida se redondea HACIA ARRIBA: puede sobrar un pedazo de día, nunca faltar.
 *
 * Devuelve el TOTAL, no lo que se suma: `sumarDiasExtraPrueba` fija el valor, y
 * pasarle sólo los días nuevos le quitaría al hotel los que ya tenía.
 */
export function calcularExtension(a: {
  finBaseMs: number;
  diasExtraActuales: number;
  dias: number;
  ahora: number;
}): Extension {
  if (!Number.isFinite(a.finBaseMs) || !Number.isFinite(a.ahora)) {
    return { ok: false, motivo: "No se pudo calcular el fin de la prueba." };
  }
  if (!Number.isInteger(a.dias) || a.dias < 1) {
    return { ok: false, motivo: "Elige cuántos días le das." };
  }
  const actuales = diasExtraSanos(a.diasExtraActuales);
  const finActual = a.finBaseMs + actuales * DIA_MS;
  const objetivo = Math.max(a.ahora, finActual) + a.dias * DIA_MS;
  const diasExtra = Math.ceil((objetivo - a.finBaseMs) / DIA_MS);
  if (diasExtra > DIAS_EXTRA_TOPE) {
    return {
      ok: false,
      motivo: `Con esto pasaría de ${DIAS_EXTRA_TOPE} días extra, que es el tope. Si de verdad quieres dárselos, mejor dale cortesía.`,
    };
  }
  return { ok: true, diasExtra, nuevoFinMs: a.finBaseMs + diasExtra * DIA_MS };
}

/** Días que le quedan con ese fin, contados como los cuenta `pruebaDelHotel`. */
export function diasRestantes(finMs: number, ahora: number): number {
  return Math.max(0, Math.ceil((finMs - ahora) / DIA_MS));
}

// ─── Demo ────────────────────────────────────────────────────────────────────

/**
 * Marcar demo se RECHAZA a quien paga con Stripe: un hotel demo no cobra (el
 * checkout del motor responde `hotel-demo` y el navegador simula el pago) y
 * Camila no se conecta. Sería cobrarle a un cliente por un motor apagado.
 */
export function puedeMarcarDemo(a: { demo: boolean; sub: SuscripcionMinima | null }): Veredicto {
  if (a.demo) return no("Ya es un hotel demo.");
  if (pagaConStripe(a.sub)) {
    return no(
      "Este dueño paga su plan con Stripe. Un hotel demo no cobra reservas ni conecta a Camila: cancela primero su plan si de verdad es de demostración.",
    );
  }
  return SI;
}

export function puedeQuitarDemo(demo: boolean): Veredicto {
  return demo ? SI : no("Este hotel no es demo.");
}

// ─── Bloqueo ─────────────────────────────────────────────────────────────────

export function mensajeBloqueoValido(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= MENSAJE_BLOQUEO_MAX ? t : null;
}

export function puedeDesbloquear(bloqueado: boolean): Veredicto {
  return bloqueado ? SI : no("Este hotel no está bloqueado.");
}

// ─── `extras`, sin mutar ─────────────────────────────────────────────────────
// Devuelven un objeto NUEVO. Mutar el que se leyó y luego escribirlo es cómo se
// cuela un cambio a medias si la escritura falla y alguien reutiliza el objeto.

type Extras = Record<string, unknown>;

function copia(extras: Extras | null | undefined): Extras {
  return extras && typeof extras === "object" && !Array.isArray(extras) ? { ...extras } : {};
}

/** `extras` con `llave` puesta a `valor` (o quitada si `valor` es undefined). */
export function extrasCon(extras: Extras | null | undefined, llave: string, valor: unknown): Extras {
  const nuevo = copia(extras);
  if (valor === undefined) delete nuevo[llave];
  else nuevo[llave] = valor;
  return nuevo;
}

/**
 * `extras` sin `prueba.avisos`, que es la marca con la que el cron de la prueba
 * recuerda que ya mandó el «te quedan 7/3/1 días» y el «tu motor está pausado».
 * Tras alargar la prueba hay que borrarla: si no, el hotel que ya había recibido
 * el de 3 días nunca recibe el de la nueva fecha, y el de «pausado» tampoco.
 *
 * `cambio: false` = no había nada que borrar (y no hace falta escribir).
 */
export function extrasSinAvisosPrueba(extras: Extras | null | undefined): { cambio: boolean; extras: Extras } {
  const nuevo = copia(extras);
  const prueba = nuevo.prueba;
  if (!prueba || typeof prueba !== "object" || Array.isArray(prueba) || !("avisos" in prueba)) {
    return { cambio: false, extras: nuevo };
  }
  const resto = { ...(prueba as Extras) };
  delete resto.avisos;
  nuevo.prueba = resto;
  return { cambio: true, extras: nuevo };
}

// ─── Situación ───────────────────────────────────────────────────────────────

/**
 * La situación del hotel en una palabra, en el MISMO orden que
 * lib/crm/operaciones.ts (gana la primera que aplique): bloqueado → demo →
 * moroso → pago → cortesía → cancelada → prueba → prueba vencida.
 *
 * Aquí devuelve `null` cuando no se pudo leer la suscripción: sin ese dato, un
 * hotel que paga saldría «prueba vencida», y es justo el cero falso que el CRM
 * no puede pintar. Bloqueado y demo no dependen de la suscripción. Lo mismo si
 * hace falta la prueba para decidir y no se pudo calcular (`pruebaVencida: null`).
 *
 * (operaciones.ts tiene esta regla escrita dentro de `cargarOperaciones`; si
 * cambia el orden allí, hay que cambiarlo aquí. tests/crm-acciones.test.ts fija
 * el orden.)
 */
export function situacionHotel(a: {
  bloqueado: boolean;
  demo: boolean;
  suscripcionLeida: boolean;
  estado: EstadoSuscripcion | null;
  pruebaVencida: boolean | null;
}): SituacionHotel | null {
  if (a.bloqueado) return "bloqueado";
  if (a.demo) return "demo";
  if (!a.suscripcionLeida) return null;
  if (a.estado === "pago_vencido") return "moroso";
  if (a.estado === "activa") return "pago";
  if (a.estado === "cortesia") return "cortesia";
  if (a.estado === "cancelada") return "cancelada";
  if (a.pruebaVencida === null) return null;
  return a.pruebaVencida ? "prueba_vencida" : "prueba";
}
