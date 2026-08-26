import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import type { PlanClave } from "@/lib/oferta";
import { alertar } from "@/lib/alertas";

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

export function pruebaDelHotel(hotel: {
  created_at?: string | null;
  extras?: Record<string, unknown> | null;
}): PruebaHotel | null {
  // El hotel de demostración nunca caduca.
  if ((hotel.extras as { demo?: boolean } | null)?.demo === true) return null;
  const creado = hotel.created_at ? Date.parse(hotel.created_at) : NaN;
  const inicio = Number.isNaN(creado) ? LANZAMIENTO_PRUEBA : Math.max(creado, LANZAMIENTO_PRUEBA);
  const fin = new Date(inicio + PRUEBA_DIAS * 86_400_000);
  const msRestantes = fin.getTime() - Date.now();
  return {
    fin,
    diasRestantes: Math.max(0, Math.ceil(msRestantes / 86_400_000)),
    vencida: msRestantes <= 0,
  };
}

export interface AccesoHotel {
  activo: boolean; // puede operar (plan pagado, cortesía, demo o prueba vigente)
  planActivo: boolean;
  prueba: PruebaHotel | null; // null si tiene plan o es demo
  /** true = Kora bloqueó la cuenta a mano (no es cosa del plan ni de la prueba). */
  bloqueado: boolean;
  /** Mensaje que ve el hotelero al entrar. Solo cuando `bloqueado`. */
  mensajeBloqueo: string | null;
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
}): Promise<AccesoHotel> {
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
    };
  }

  const lectura = await leerSuscripcion(hotel.owner_id);
  if (tienePlanActivo(lectura.sub)) {
    return { activo: true, planActivo: true, prueba: null, bloqueado: false, mensajeBloqueo: null };
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
    return { activo: true, planActivo: false, prueba: null, bloqueado: false, mensajeBloqueo: null };
  }

  const prueba = pruebaDelHotel(hotel);
  return {
    activo: !prueba || !prueba.vencida,
    planActivo: false,
    prueba,
    bloqueado: false,
    mensajeBloqueo: null,
  };
}
