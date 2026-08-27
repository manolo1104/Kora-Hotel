import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import type { PlanClave } from "@/lib/oferta";
import { alertar } from "@/lib/alertas";
import { inicioPruebaDelDueno } from "@/lib/db/prueba-dueno";

// Estado de suscripción de un usuario. SOLO servidor (usa la service-role key).

export type EstadoSuscripcion =
  | "activa"
  | "pago_vencido"
  | "cancelada"
  | "incompleta"
  | "cortesia";

export interface Suscripcion {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: PlanClave | null;
  estado: EstadoSuscripcion;
  periodo_fin: string | null;
  cancela_al_final: boolean;
  avisos_dunning: number;
}

/**
 * Resultado de leer la suscripción, distinguiendo "este dueño no tiene plan" de
 * "no pude consultar si tiene plan". Antes ambos casos devolvían `null` y eran
 * indistinguibles: ver `accesoDelHotel`.
 */
export interface LecturaSuscripcion {
  /** false = la CONSULTA falló. No significa que el usuario no tenga plan. */
  ok: boolean;
  sub: Suscripcion | null;
}

export async function leerSuscripcion(userId: string): Promise<LecturaSuscripcion> {
  // Sin service-role no hay nada que consultar; se conserva el comportamiento de
  // siempre (sin plan → mandan las reglas de la prueba), porque esto es un estado
  // de configuración y no un fallo pasajero.
  if (!adminEnvReady) return { ok: true, sub: null };
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("suscripciones")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    // Antes este error se descartaba y ni siquiera quedaba en el log.
    console.error(`leerSuscripcion: no se pudo leer la suscripción de ${userId}:`, error);
    return { ok: false, sub: null };
  }
  return { ok: true, sub: (data as Suscripcion) ?? null };
}

/** La suscripción del usuario, o null si no tiene —o si no se pudo leer. */
export async function getSuscripcion(userId: string): Promise<Suscripcion | null> {
  return (await leerSuscripcion(userId)).sub;
}

// Días de gracia con pago vencido: cubre los reintentos de cobro de Stripe
// (~3 semanas). Después de eso, sin pago no hay acceso — aunque el estado en
// Stripe se quede en "unpaid" en vez de "canceled" (depende de configuración
// del dashboard, no del código).
const GRACIA_PAGO_VENCIDO_DIAS = 21;

/**
 * Un plan cuenta como activo si está pagado, es cortesía (cuentas dadas de
 * alta a mano), o tiene un pago vencido RECIENTE (gracia acotada mientras
 * Stripe reintenta el cobro).
 */
export function tienePlanActivo(s: Suscripcion | null): boolean {
  if (!s) return false;
  if (s.estado === "activa" || s.estado === "cortesia") return true;
  if (s.estado === "pago_vencido") {
    // Sin periodo_fin legible somos permisivos (no castigar a un cliente por
    // un dato faltante); con él, la gracia termina 21 días después.
    if (!s.periodo_fin) return true;
    const fin = new Date(s.periodo_fin).getTime();
    if (Number.isNaN(fin)) return true;
    return Date.now() <= fin + GRACIA_PAGO_VENCIDO_DIAS * 86_400_000;
  }
  return false;
}

/** Plan activo del dueño de un hotel (para la mini-página pública). */
export async function ownerTienePlanActivo(ownerId: string): Promise<boolean> {
  return tienePlanActivo(await getSuscripcion(ownerId));
}

// ─── Prueba de 30 días SIN tarjeta ───────────────────────────────────────────
// La prueba se DERIVA del created_at del hotel (sin columnas nuevas ni
// migraciones): 30 días desde su creación. Para hoteles creados antes del
// lanzamiento de la prueba, corre desde el lanzamiento — nadie amanece pausado
// por un cambio de reglas retroactivo.

export const PRUEBA_DIAS = 30;
const LANZAMIENTO_PRUEBA = Date.parse("2026-07-10T00:00:00-06:00");

export interface PruebaHotel {
  fin: Date;
  diasRestantes: number; // 0 cuando ya venció
  vencida: boolean;
}

export function pruebaDelHotel(
  hotel: {
    created_at?: string | null;
    extras?: Record<string, unknown> | null;
  },
  /**
   * Cuándo empezó la prueba de ESTE DUEÑO (ISO), de la tabla `pruebas`. Es
   * opcional para no cambiarle las reglas a nadie retroactivamente: sin ese dato
   * todo se comporta como siempre.
   */
  inicioDelDueno?: string | null,
): PruebaHotel | null {
  // El hotel de demostración nunca caduca.
  if ((hotel.extras as { demo?: boolean } | null)?.demo === true) return null;
  const creado = hotel.created_at ? Date.parse(hotel.created_at) : NaN;
  const delDueno = inicioDelDueno ? Date.parse(inicioDelDueno) : NaN;
  // El ancla es la primera vez que este DUEÑO dio de alta un hotel, no la de
  // ESTE hotel. Anclarla al hotel hacía la prueba infinita: el panel deja
  // borrarlo y volver a crearlo, y con eso arrancaban otros 30 días gratis, una
  // y otra vez. Se toma la MÁS ANTIGUA de las dos fechas, para que sembrar el
  // ancla tarde nunca le quite días a nadie.
  const fechas = [creado, delDueno].filter((n) => !Number.isNaN(n));
  const base = fechas.length ? Math.min(...fechas) : NaN;
  const inicio = Number.isNaN(base) ? LANZAMIENTO_PRUEBA : Math.max(base, LANZAMIENTO_PRUEBA);
  const fin = new Date(inicio + PRUEBA_DIAS * 86_400_000);
  const msRestantes = fin.getTime() - Date.now();
  return {
    fin,
    diasRestantes: Math.max(0, Math.ceil(msRestantes / 86_400_000)),
    vencida: msRestantes <= 0,
  };
}

// ─── El mínimo de Stripe para respetar la prueba que le QUEDA ────────────────
// Stripe rechaza cualquier `trial_end` a menos de 48 h de distancia. La guarda
// vieja del checkout miraba `prueba.diasRestantes >= 2`, y `diasRestantes` se
// calcula con `Math.ceil`: con 25 h restantes ya vale 2, así que se le mandaba a
// Stripe un `trial_end` a 25 h, Stripe rechazaba la sesión y el hotelero veía
// "No pudimos iniciar el pago". Traducido: NO SE TE PODÍA PAGAR durante las
// últimas 24-48 h de la prueba — justo cuando le llega el correo de "mañana
// termina" y cuando más ganas tiene de contratar.
//
// La comparación va en MILISEGUNDOS, nunca en días redondeados, y con una hora
// de holgura sobre el mínimo de Stripe para cubrir el rato que pasa entre que se
// arma la sesión de pago y el hotelero la completa.
const STRIPE_TRIAL_END_MIN_MS = 49 * 3_600_000;

/**
 * El `trial_end` en segundos Unix que se le manda a Stripe para respetar lo que
 * le queda de prueba al hotelero, o `null` si ya no cabe una prueba en Stripe y
 * el cobro tiene que correr desde hoy (que es lo que la pantalla de Stripe le
 * enseña antes de confirmar, así que no hay sorpresa).
 */
export function trialEndParaStripe(
  prueba: PruebaHotel | null,
  ahora: number = Date.now(),
): number | null {
  if (!prueba || prueba.vencida) return null;
  if (prueba.fin.getTime() - ahora < STRIPE_TRIAL_END_MIN_MS) return null;
  return Math.floor(prueba.fin.getTime() / 1000);
}

export interface AccesoHotel {
  activo: boolean; // puede operar (plan pagado, cortesía, demo o prueba vigente)
  planActivo: boolean;
  prueba: PruebaHotel | null; // null si tiene plan o es demo
  /** true = Kora bloqueó la cuenta a mano (no es cosa del plan ni de la prueba). */
  bloqueado: boolean;
  /** Mensaje que ve el hotelero al entrar. Solo cuando `bloqueado`. */
  mensajeBloqueo: string | null;
  /**
   * El hotel está publicado. NO entra dentro de `activo` a propósito: un hotel
   * recién creado está SIN publicar mientras lo montan, y su dueño tiene que
   * poder usar el panel entero mientras tanto. Lo que un hotel sin publicar no
   * puede hacer es COBRAR.
   */
  publicado: boolean;
  /**
   * `activo && publicado`. Es la ÚNICA que debe mirar quien vaya a mover dinero.
   *
   * `publicado` se respetaba en 5 superficies y se ignoraba en 7: el motor de un
   * hotel DESPUBLICADO seguía cobrando con tarjeta (K-124, K-158). Despublicar
   * es la forma que tiene un hotelero de decir "esto no está al público"; que le
   * siguieran entrando reservas por ahí es lo contrario de lo que pidió.
   */
  puedeCobrar: boolean;
}

/** Bloqueo manual guardado en `hoteles.extras.bloqueo`. */
export interface BloqueoHotel {
  activo: boolean;
  mensaje?: string | null;
  fecha?: string | null; // ISO, cuándo se bloqueó
}

const MENSAJE_BLOQUEO_DEFAULT = "Kora bloqueó esta cuenta.";

/** Lee el bloqueo manual de `extras.bloqueo`. Nunca lanza. */
export function bloqueoDelHotel(extras?: Record<string, unknown> | null): BloqueoHotel | null {
  const b = (extras ?? {})["bloqueo"];
  if (!b || typeof b !== "object") return null;
  const raw = b as Record<string, unknown>;
  if (raw.activo !== true) return null;
  return {
    activo: true,
    mensaje: typeof raw.mensaje === "string" && raw.mensaje.trim() ? raw.mensaje.trim() : null,
    fecha: typeof raw.fecha === "string" ? raw.fecha : null,
  };
}

/**
 * Acceso operativo de un hotel: plan del dueño O prueba vigente. Es EL punto
 * único que decide si el motor cobra y el panel opera.
 */
export async function accesoDelHotel(hotel: {
  owner_id: string;
  created_at?: string | null;
  extras?: Record<string, unknown> | null;
  /** Ausente = se asume publicado, para no cambiarle nada a quien no lo pasa. */
  publicado?: boolean | null;
}): Promise<AccesoHotel> {
  const publicado = hotel.publicado !== false;
  // El bloqueo manual gana sobre TODO lo demás: aunque el dueño tenga el plan
  // pagado al corriente, la cuenta no opera. Como este es el punto único por el
  // que pasan panel, motor, checkout, bot y agente, con esto se apaga entera.
  const bloqueo = bloqueoDelHotel(hotel.extras);
  if (bloqueo) {
    return {
      activo: false,
      planActivo: false,
      prueba: null,
      bloqueado: true,
      mensajeBloqueo: bloqueo.mensaje || MENSAJE_BLOQUEO_DEFAULT,
      publicado,
      puedeCobrar: false,
    };
  }

  const lectura = await leerSuscripcion(hotel.owner_id);
  if (tienePlanActivo(lectura.sub)) {
    return {
      activo: true,
      planActivo: true,
      prueba: null,
      bloqueado: false,
      mensajeBloqueo: null,
      publicado,
      puedeCobrar: publicado,
    };
  }

  // No se pudo LEER la suscripción. Eso NO es "no tiene plan": antes las dos
  // cosas devolvían null, así que un hipo de Supabase degradaba a un hotel de
  // pago con más de 30 días de antigüedad a "prueba vencida" y le apagaba el
  // motor — los CTA de su página dejaban de llevar al motor y el checkout
  // rechazaba el cobro, sin mensaje y sin traza. Se falla ABIERTO: se mantiene el
  // acceso durante el incidente. `planActivo` queda en false a propósito, para no
  // regalar los extras de Pro que no se pudieron verificar; lo único que cambia
  // es que la marca de Kora sigue visible mientras dure.
  if (!lectura.ok) {
    await alertar(
      "no se pudo leer una suscripción",
      `Dueño ${hotel.owner_id}. Se le MANTIENE el acceso abierto mientras dure el ` +
        `incidente (fallar cerrado le apagaría el motor a un cliente que paga). ` +
        `Si esto se repite, la plataforma está operando sin saber quién tiene plan.`,
    );
    return {
      activo: true,
      planActivo: false,
      prueba: null,
      bloqueado: false,
      mensajeBloqueo: null,
      publicado,
      puedeCobrar: publicado,
    };
  }

  // El ancla de la prueba sólo se consulta AQUÍ, después de descartar que tenga
  // plan: a un cliente de pago esta lectura no le cuesta nada. Nunca lanza — si
  // no se puede leer, se cae al `created_at` de siempre.
  const prueba = pruebaDelHotel(hotel, await inicioPruebaDelDueno(hotel.owner_id));
  const activo = !prueba || !prueba.vencida;
  return {
    activo,
    planActivo: false,
    prueba,
    bloqueado: false,
    mensajeBloqueo: null,
    publicado,
    puedeCobrar: activo && publicado,
  };
}
