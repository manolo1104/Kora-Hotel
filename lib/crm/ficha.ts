// La ficha de UN hotel para el fundador, y la lista de todos. SOLO servidor
// (service-role y Stripe): en componentes cliente, sólo `import type`.
//
// Hasta el 15 sep 2026, «¿qué pasa con este hotel?» se contestaba abriendo
// Supabase, Stripe y los logs de Railway por separado, y /crm/hoteles sólo
// servía para bloquear. Aquí se junta todo lo de un hotel en una sola carga.
//
// ── LA REGLA DE CADA BLOQUE ──────────────────────────────────────────────────
//
// Heredada de lib/crm/operaciones.ts: el silencio y el cero se ven distintos.
// Cada dato viaja en un `Bloque` que dice si se leyó, si falta correr un SQL
// (nota gris con el archivo) o si la lectura falló (se dice «no se pudo leer»).
// La página vieja de hoteles ignoraba el error de la consulta y, con la base
// caída, decía «No hay hoteles todavía»: esa es la mentira que esto evita.
//
// Lo externo (Stripe, el servidor de Camila) va con tope de espera: la ficha no
// puede quedarse cargando porque Stripe tarda.

import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { stripeEnvReady } from "@/lib/stripe/server";
import {
  accesoDelHotel,
  bloqueoDelHotel,
  finDePrueba,
  inicioDePrueba,
  pruebaDelHotel,
  tienePlanActivo,
  type AccesoHotel,
  type EstadoSuscripcion,
  type Suscripcion,
} from "@/lib/suscripcion";
import { getConnectState } from "@/lib/stripe/connect";
import { decidirModoPrueba } from "@/lib/motor/modo-prueba";
import { motivosSinBot, type MotivoSinBot } from "@/lib/bot/elegibilidad";
import {
  cobrosPorHotel,
  estadoCamilaTodos,
  saldosPorHotel,
  suscripcionesStripe,
  todosLosUsuarios,
  type EstadoCamila,
  type SaldoDeHotel,
  type SuscripcionStripe,
} from "@/lib/crm/fuentes";
import { leerBitacora, type FilaBitacora } from "@/lib/crm/bitacora";
import { fasesSaldo, type FasesSaldo } from "@/lib/saldo/fases";
import { reservaCuenta } from "@/lib/booking/estado-reserva";
import { VENTANA_DIAS } from "@/lib/crm/types";
import { diasExtraSanos, diasRestantes, pagaConStripe, situacionHotel } from "@/lib/crm/acciones";
import type { SituacionHotel } from "@/lib/crm/operaciones";

// ─── Piezas comunes ──────────────────────────────────────────────────────────

/** Un dato de la ficha: leído, pendiente de SQL, o no se pudo leer. */
export type Bloque<T> =
  | { estado: "ok"; data: T; aviso?: string }
  | { estado: "falta-sql"; archivo: string }
  | { estado: "error"; detalle: string };

/** Códigos de PostgREST/Postgres para «esa tabla o columna no existe aquí». */
const NO_EXISTE = new Set(["42P01", "42703", "PGRST205", "PGRST204"]);
const SIN_COLUMNA = new Set(["42703", "PGRST204"]);

function noExiste(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && NO_EXISTE.has(error.code)) return true;
  return /Could not find the table|relation .* does not exist/i.test(error.message ?? "");
}

function sinColumna(error: { code?: string; message?: string } | null, columna: string): boolean {
  if (!error) return false;
  if (error.code && SIN_COLUMNA.has(error.code)) return true;
  const m = error.message ?? "";
  return m.includes(columna) && /does not exist|Could not find/i.test(m);
}

/** Rechaza si `p` no termina en `ms`. No cancela la operación, sólo deja de esperarla. */
function conTope<T>(p: PromiseLike<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<never>((_, rechazar) => {
    timer = setTimeout(() => rechazar(new Error(`sin respuesta en ${ms} ms`)), ms);
  });
  return Promise.race([Promise.resolve(p), tope]).finally(() => clearTimeout(timer));
}

const TOPE_RESERVAS = 5000;

type ErrorPg = { code?: string; message?: string } | null;

/**
 * Enlace al panel de Stripe. Con una llave de PRUEBA (`sk_test_…`/`rk_test_…`)
 * los objetos viven bajo `/test`: el enlace sin ese prefijo abre «no existe» en
 * modo real, y en local o en un preview eso parece un cliente borrado.
 */
function urlPanelStripe(ruta: string): string {
  const prueba = /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY ?? "");
  return `https://dashboard.stripe.com${prueba ? "/test" : ""}${ruta}`;
}

const PAGINA = 1000;

/**
 * Todas las filas de una consulta, de mil en mil.
 *
 * PostgREST corta cada respuesta en su `max_rows` (1000 en Supabase) SIN avisar:
 * la primera versión de la lista pedía `hoteles` y `suscripciones` de un golpe,
 * y el hotel 1001 —o la suscripción 1001— desaparecía en silencio, con lo que un
 * dueño que paga salía «en prueba». Se pide el total en la primera página y, si
 * no se llegó a leerlo entero, se dice (`recortadas`).
 */
async function leerPaginado<T>(
  pedir: (desde: number, hasta: number, contar: boolean) => PromiseLike<{ data: unknown; error: ErrorPg; count?: number | null }>,
  tope: number,
): Promise<{ filas: T[]; error: ErrorPg; recortadas: boolean }> {
  const filas: T[] = [];
  let total: number | null = null;
  try {
    for (let desde = 0; desde < tope; desde += PAGINA) {
      const hasta = Math.min(desde + PAGINA, tope) - 1;
      const r = await pedir(desde, hasta, desde === 0);
      if (r.error) return { filas: [], error: r.error, recortadas: false };
      if (desde === 0 && typeof r.count === "number") total = r.count;
      const lote = (r.data ?? []) as T[];
      filas.push(...lote);
      if (lote.length < hasta - desde + 1) break;
    }
    const recortadas = total !== null ? total > filas.length : filas.length >= tope;
    return { filas, error: null, recortadas };
  } catch (e) {
    return { filas: [], error: { message: e instanceof Error ? e.message : String(e) }, recortadas: false };
  }
}

// ─── Lectores que también usa la API de acciones ─────────────────────────────

export interface FilaSuscripcion {
  estado: EstadoSuscripcion;
  plan: string | null;
  periodo_fin: string | null;
  cancela_al_final: boolean | null;
  avisos_dunning: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

export type LecturaSuscripcionDueno =
  | { estado: "ok"; sub: FilaSuscripcion | null }
  | { estado: "falta-sql" }
  | { estado: "error" };

/**
 * La suscripción del dueño, distinguiendo «no tiene» de «no pude leer». Los
 * botones de cortesía y demo DECIDEN con esto, así que un fallo nunca puede
 * pasar por «no tiene plan» (eso regalaría cortesía a quien paga).
 */
export async function leerSuscripcionDelDueno(ownerId: string): Promise<LecturaSuscripcionDueno> {
  if (!adminEnvReady || !ownerId) return { estado: "error" };
  try {
    const { data, error } = await createAdminClient()
      .from("suscripciones")
      .select("estado, plan, periodo_fin, cancela_al_final, avisos_dunning, stripe_customer_id, stripe_subscription_id")
      .eq("user_id", ownerId)
      .maybeSingle();
    if (error) {
      if (noExiste(error)) return { estado: "falta-sql" };
      console.error(`[crm/ficha] no se pudo leer la suscripción de ${ownerId}:`, error.message);
      return { estado: "error" };
    }
    return { estado: "ok", sub: (data as FilaSuscripcion | null) ?? null };
  } catch (e) {
    console.error("[crm/ficha] error leyendo la suscripción:", e);
    return { estado: "error" };
  }
}

/** `tienePlanActivo` con la fila recortada que se lee aquí (sólo mira estado y periodo_fin). */
export function planActivoDe(sub: FilaSuscripcion | null): boolean {
  return tienePlanActivo(sub ? (sub as unknown as Suscripcion) : null);
}

export type LecturaPrueba =
  | {
      estado: "ok";
      /** `pruebas.inicio`, o null si el dueño no tiene fila. */
      inicio: string | null;
      diasExtra: number;
      tieneFila: boolean;
      /** Falta `pruebas.dias_extra` (sql/kora-crm-mando.sql). */
      faltaColumna: boolean;
      /** Falta la tabla `pruebas` (sql/kora-prueba-por-dueno.sql). */
      faltaTabla: boolean;
    }
  | { estado: "error" };

/**
 * El ancla y los días extra del dueño, SIN tragarse el error.
 *
 * `anclaPruebaDelDueno` (lib/db/prueba-dueno.ts) devuelve «sin dato» tanto si
 * el dueño no tiene fila como si la consulta falló, y para el sitio público eso
 * está bien. Para alargar una prueba NO: `sumarDiasExtraPrueba` FIJA el total,
 * así que leer 0 por un fallo y escribir 0 + 7 le borraría al hotel los 14 que
 * ya tenía. Por eso aquí un fallo es un fallo.
 */
export async function leerPruebaDelDueno(ownerId: string): Promise<LecturaPrueba> {
  if (!adminEnvReady || !ownerId) return { estado: "error" };
  try {
    const admin = createAdminClient();
    const r = await admin.from("pruebas").select("inicio, dias_extra").eq("user_id", ownerId).maybeSingle();
    if (!r.error) {
      const fila = r.data as { inicio?: string | null; dias_extra?: unknown } | null;
      return {
        estado: "ok",
        inicio: fila?.inicio ?? null,
        diasExtra: diasExtraSanos(fila?.dias_extra),
        tieneFila: Boolean(fila),
        faltaColumna: false,
        faltaTabla: false,
      };
    }
    if (sinColumna(r.error, "dias_extra")) {
      const r2 = await admin.from("pruebas").select("inicio").eq("user_id", ownerId).maybeSingle();
      if (r2.error) {
        console.error(`[crm/ficha] no se pudo leer el inicio de la prueba de ${ownerId}:`, r2.error.message);
        return { estado: "error" };
      }
      const fila = r2.data as { inicio?: string | null } | null;
      return {
        estado: "ok",
        inicio: fila?.inicio ?? null,
        diasExtra: 0,
        tieneFila: Boolean(fila),
        faltaColumna: true,
        faltaTabla: false,
      };
    }
    if (noExiste(r.error)) {
      return { estado: "ok", inicio: null, diasExtra: 0, tieneFila: false, faltaColumna: true, faltaTabla: true };
    }
    console.error(`[crm/ficha] no se pudo leer la prueba de ${ownerId}:`, r.error.message);
    return { estado: "error" };
  } catch (e) {
    console.error("[crm/ficha] error leyendo la prueba:", e);
    return { estado: "error" };
  }
}

// ─── La ficha ────────────────────────────────────────────────────────────────

export interface DuenoFicha {
  id: string;
  email: string | null;
  altaCuenta: string | null;
  ultimoAcceso: string | null;
  correoConfirmado: boolean;
}

export interface PlanFicha {
  /** null = el dueño no tiene fila en `suscripciones`. */
  estado: EstadoSuscripcion | null;
  planClave: string | null;
  periodoFin: string | null;
  cancelaAlFinal: boolean;
  avisosDunning: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  /** Lo mismo que decide el acceso: activa, cortesía o pago vencido dentro de la gracia. */
  planActivo: boolean;
  pagaConStripe: boolean;
}

export interface PruebaFicha {
  /** false = demo, o tiene plan/cortesía: la prueba existe pero hoy no manda. */
  aplica: boolean;
  inicio: string;
  fin: string;
  diasRestantes: number;
  vencida: boolean;
  diasExtra: number;
  /**
   * Fin SIN días extra con el inicio que quedará al alargar (el hotel más
   * antiguo del dueño). La ficha lo usa para enseñar «hasta cuándo le llega»
   * antes de confirmar, con la misma cuenta que hace la API.
   */
  finBaseExtensionMs: number;
  /** Falta sql/kora-crm-mando.sql (o la tabla `pruebas`): no se pueden dar días. */
  faltaSqlDiasExtra: boolean;
  faltaSqlAncla: boolean;
}

export interface CobrosFicha {
  accountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingStatus: string;
  requirementsDue: number;
}

export interface SaldoFicha {
  /** false = nunca se le acreditó nada: Camila no se le calla por saldo. */
  enPrepago: boolean;
  mensajes: number | null;
  /** null = no se pudo contar (NO es cero). */
  consumo30d: number | null;
}

export interface ReservasFicha {
  total: number;
  recientes: number;
  gmvTotal: number;
  gmvReciente: number;
  ultima: string | null;
  recortadas: boolean;
}

export interface FichaHotel {
  hotel: {
    id: string;
    slug: string;
    nombre: string;
    ownerId: string;
    ubicacion: string | null;
    whatsapp: string | null;
    publicado: boolean;
    createdAt: string | null;
    demo: boolean;
    bloqueo: { mensaje: string | null; fecha: string | null } | null;
  };
  /** Los demás hoteles del mismo dueño (la prueba y el plan son por dueño). */
  otrosHoteles: Bloque<{ slug: string; nombre: string }[]>;
  dueno: Bloque<DuenoFicha | null>;
  /** null = no se pudo saber (faltó leer el plan o la prueba). */
  situacion: SituacionHotel | null;
  plan: Bloque<PlanFicha>;
  /** null = no hay cliente de Stripe que consultar. */
  stripe: Bloque<SuscripcionStripe | null> | null;
  prueba: Bloque<PruebaFicha>;
  cobros: Bloque<CobrosFicha>;
  modoPrueba: Bloque<boolean>;
  camila: {
    runtime: Bloque<EstadoCamila | null>;
    motivos: MotivoSinBot[];
    /**
     * false = no se pudo calcular su acceso: `motivos` no incluye «sin-acceso»
     * porque no se sabe, y la ficha lo tiene que decir.
     */
    accesoLeido: boolean;
    botEncendido: boolean;
  };
  saldo: Bloque<SaldoFicha>;
  fases: FasesSaldo | null;
  reservas: Bloque<ReservasFicha>;
  bitacora: Bloque<FilaBitacora[]>;
  enlaces: { sitio: string; motor: string; stripeCliente: string | null; stripeCuenta: string | null };
  ventanaDias: number;
}

export type ResultadoFicha =
  | { tipo: "ok"; ficha: FichaHotel }
  | { tipo: "no-existe" }
  | { tipo: "error"; detalle: string };

interface FilaHotel {
  id: string;
  slug: string;
  nombre: string;
  owner_id: string;
  ubicacion: string | null;
  whatsapp: string | null;
  publicado: boolean | null;
  extras: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
  created_at: string | null;
  stripe_account_id: string | null;
}

const SQL_SUSCRIPCIONES = "sql/kora-suscripciones-schema.sql";

async function leerDueno(ownerId: string): Promise<Bloque<DuenoFicha | null>> {
  try {
    const { data, error } = await conTope(createAdminClient().auth.admin.getUserById(ownerId), 8_000);
    if (error) {
      // La cuenta se borró y el hotel quedó huérfano: eso es un dato, no un fallo.
      if ((error as { status?: number }).status === 404) return { estado: "ok", data: null };
      console.error(`[crm/ficha] no se pudo leer al dueño ${ownerId}:`, error.message);
      return { estado: "error", detalle: "No se pudo leer la cuenta del dueño." };
    }
    const u = data?.user;
    if (!u) return { estado: "ok", data: null };
    return {
      estado: "ok",
      data: {
        id: u.id,
        email: u.email ?? null,
        altaCuenta: u.created_at ?? null,
        ultimoAcceso: u.last_sign_in_at ?? null,
        correoConfirmado: Boolean(u.email_confirmed_at),
      },
    };
  } catch (e) {
    console.error("[crm/ficha] error leyendo al dueño:", e);
    return { estado: "error", detalle: "No se pudo leer la cuenta del dueño." };
  }
}

async function leerReservas(hotelId: string): Promise<Bloque<ReservasFicha>> {
  try {
    const { data, error } = await createAdminClient()
      .from("bookings")
      .select("total, estado, created_at")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: false })
      .limit(TOPE_RESERVAS);
    if (error) {
      if (noExiste(error)) return { estado: "falta-sql", archivo: "sql/kora-multitenant-fase0.sql" };
      console.error(`[crm/ficha] no se pudieron leer las reservas de ${hotelId}:`, error.message);
      return { estado: "error", detalle: "No se pudieron leer las reservas." };
    }
    const filas = (data ?? []) as { total: number | null; estado: string | null; created_at: string | null }[];
    const desde = new Date(Date.now() - VENTANA_DIAS * 86_400_000).toISOString();
    const r: ReservasFicha = {
      total: 0,
      recientes: 0,
      gmvTotal: 0,
      gmvReciente: 0,
      // Viene ordenada de la más nueva a la más vieja.
      ultima: filas[0]?.created_at ?? null,
      recortadas: filas.length >= TOPE_RESERVAS,
    };
    // Misma regla que operaciones.ts: cancelada y reembolsada cuentan como uso
    // del producto, pero no como dinero.
    for (const b of filas) {
      const monto = reservaCuenta(b.estado) ? Number(b.total ?? 0) : 0;
      const reciente = Boolean(b.created_at && b.created_at >= desde);
      r.total++;
      r.gmvTotal += monto;
      if (reciente) {
        r.recientes++;
        r.gmvReciente += monto;
      }
    }
    return r.recortadas
      ? { estado: "ok", data: r, aviso: `Sólo se leyeron las ${TOPE_RESERVAS} reservas más recientes.` }
      : { estado: "ok", data: r };
  } catch (e) {
    console.error("[crm/ficha] error leyendo las reservas:", e);
    return { estado: "error", detalle: "No se pudieron leer las reservas." };
  }
}

function detalleCamila(error: string | undefined): string {
  if (error === "sin-runtime") return "Este entorno no tiene configurado el servidor de Camila.";
  if (error === "sin-respuesta") return "El servidor de Camila no contestó a tiempo.";
  if (error === "respuesta-ilegible") return "El servidor de Camila contestó algo que no se entiende.";
  return "El servidor de Camila contestó con un error.";
}

/**
 * `accesoDelHotel` no lanza por diseño, pero lo que llama (la alerta por correo,
 * la lectura del ancla) sí podría con un fallo inesperado, y es UNA de las diez
 * lecturas en paralelo de la ficha: un rechazo ahí tiraba el `Promise.all`
 * entero y la ficha pasaba a la pantalla de error del CRM. Aquí un fallo es
 * «no se pudo calcular su acceso» y el resto de la ficha se ve.
 */
async function accesoSeguro(h: FilaHotel): Promise<AccesoHotel | null> {
  try {
    return await accesoDelHotel(h);
  } catch (e) {
    console.error(`[crm/ficha] no se pudo calcular el acceso de ${h.slug}:`, e);
    return null;
  }
}

async function fasesSeguras(): Promise<FasesSaldo | null> {
  try {
    return await fasesSaldo();
  } catch (e) {
    console.error("[crm/ficha] no se pudieron leer las fases del prepago:", e);
    return null;
  }
}

/** El `created_at` más antiguo de una lista, o null. */
function masAntiguo(fechas: (string | null | undefined)[]): string | null {
  let mejor: number | null = null;
  let iso: string | null = null;
  for (const f of fechas) {
    const t = f ? Date.parse(f) : NaN;
    if (Number.isNaN(t)) continue;
    if (mejor === null || t < mejor) {
      mejor = t;
      iso = f as string;
    }
  }
  return iso;
}

/**
 * Todo lo de un hotel, por slug. NUNCA lanza.
 *
 * `no-existe` sólo cuando la consulta contestó bien y no hay hotel: un fallo de
 * la base es `error`, para no mandar al fundador a un 404 con la base caída.
 */
export async function cargarFichaHotel(slug: string): Promise<ResultadoFicha> {
  // La red de «nunca lanza»: cada lectura ya atrapa lo suyo, pero un fallo que se
  // cuele (un tipo raro de Stripe, un bug nuevo) no puede convertir la ficha en
  // la pantalla genérica de error sin decir qué pasó.
  try {
    return await cargarFicha(slug);
  } catch (e) {
    console.error(`[crm/ficha] la ficha de ${slug} falló:`, e);
    return { tipo: "error", detalle: "Algo falló al juntar los datos de este hotel. Recarga en un momento." };
  }
}

async function cargarFicha(slug: string): Promise<ResultadoFicha> {
  if (!adminEnvReady) {
    return { tipo: "error", detalle: "No hay conexión a la base de datos (falta SUPABASE_SERVICE_ROLE_KEY)." };
  }
  if (typeof slug !== "string" || !slug || slug.length > 200) return { tipo: "no-existe" };

  let h: FilaHotel;
  try {
    const { data, error } = await createAdminClient()
      .from("hoteles")
      .select("id, slug, nombre, owner_id, ubicacion, whatsapp, publicado, extras, config, created_at, stripe_account_id")
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      console.error(`[crm/ficha] no se pudo leer el hotel ${slug}:`, error.message);
      return { tipo: "error", detalle: "No se pudo leer el hotel. Recarga en un momento." };
    }
    if (!data) return { tipo: "no-existe" };
    h = data as FilaHotel;
  } catch (e) {
    console.error("[crm/ficha] error leyendo el hotel:", e);
    return { tipo: "error", detalle: "No se pudo leer el hotel. Recarga en un momento." };
  }

  const extras = h.extras ?? {};
  const demo = (extras as { demo?: unknown }).demo === true;
  const bloqueo = bloqueoDelHotel(extras);
  const ahora = Date.now();

  const [dueno, lecturaSusc, lecturaPrueba, rHermanos, reservas, bitacora, camila, saldos, fases, acceso] =
    await Promise.all([
      leerDueno(h.owner_id),
      leerSuscripcionDelDueno(h.owner_id),
      leerPruebaDelDueno(h.owner_id),
      createAdminClient()
        .from("hoteles")
        .select("slug, nombre, created_at")
        .eq("owner_id", h.owner_id)
        .order("created_at", { ascending: true })
        .then(
          (r) => r,
          (e: unknown) => ({ data: null, error: { message: String(e) } }),
        ),
      leerReservas(h.id),
      leerBitacora({ hotelId: h.id, limite: 50 }),
      estadoCamilaTodos(),
      saldosPorHotel(),
      fasesSeguras(),
      accesoSeguro(h),
    ]);

  // ── Plan ──────────────────────────────────────────────────────────────────
  const sub = lecturaSusc.estado === "ok" ? lecturaSusc.sub : null;
  const planActivo = planActivoDe(sub);
  const plan: Bloque<PlanFicha> =
    lecturaSusc.estado === "ok"
      ? {
          estado: "ok",
          data: {
            estado: sub?.estado ?? null,
            planClave: sub?.plan ?? null,
            periodoFin: sub?.periodo_fin ?? null,
            cancelaAlFinal: sub?.cancela_al_final === true,
            avisosDunning: sub?.avisos_dunning ?? 0,
            stripeCustomerId: sub?.stripe_customer_id ?? null,
            stripeSubscriptionId: sub?.stripe_subscription_id ?? null,
            planActivo,
            pagaConStripe: pagaConStripe(sub),
          },
        }
      : lecturaSusc.estado === "falta-sql"
        ? { estado: "falta-sql", archivo: SQL_SUSCRIPCIONES }
        : { estado: "error", detalle: "No se pudo leer el plan del dueño." };

  // ── Hoteles del mismo dueño ───────────────────────────────────────────────
  const hermanos = (rHermanos.data ?? []) as { slug: string; nombre: string; created_at: string | null }[];
  const otrosHoteles: FichaHotel["otrosHoteles"] = rHermanos.error
    ? { estado: "error", detalle: "No se pudieron leer los otros hoteles del dueño." }
    : { estado: "ok", data: hermanos.filter((x) => x.slug !== h.slug).map((x) => ({ slug: x.slug, nombre: x.nombre })) };

  // ── Prueba ────────────────────────────────────────────────────────────────
  let prueba: Bloque<PruebaFicha>;
  if (lecturaPrueba.estado === "error") {
    prueba = { estado: "error", detalle: "No se pudo leer cuándo empezó su prueba." };
  } else {
    // La misma cuenta que `accesoDelHotel`: alta de ESTE hotel + ancla del dueño.
    const inicioMs = inicioDePrueba(h.created_at, lecturaPrueba.inicio);
    const fin = finDePrueba(inicioMs, lecturaPrueba.diasExtra);
    // Al alargar sin fila en `pruebas`, la API la crea con el alta del hotel MÁS
    // ANTIGUO del dueño: la vista previa tiene que partir del mismo inicio.
    const baseAlta = masAntiguo([h.created_at, ...hermanos.map((x) => x.created_at)]) ?? h.created_at;
    const finBaseExtensionMs = finDePrueba(inicioDePrueba(baseAlta, lecturaPrueba.inicio), 0).getTime();
    const vigente = pruebaDelHotel(h, lecturaPrueba.inicio, lecturaPrueba.diasExtra);
    prueba = {
      estado: "ok",
      data: {
        aplica: !demo && !planActivo && lecturaSusc.estado === "ok",
        inicio: new Date(inicioMs).toISOString(),
        fin: fin.toISOString(),
        diasRestantes: vigente ? vigente.diasRestantes : diasRestantes(fin.getTime(), ahora),
        vencida: vigente ? vigente.vencida : fin.getTime() <= ahora,
        diasExtra: lecturaPrueba.diasExtra,
        finBaseExtensionMs,
        faltaSqlDiasExtra: lecturaPrueba.faltaColumna || lecturaPrueba.faltaTabla,
        faltaSqlAncla: lecturaPrueba.faltaTabla,
      },
    };
  }

  const situacion = situacionHotel({
    bloqueado: Boolean(bloqueo),
    demo,
    suscripcionLeida: lecturaSusc.estado === "ok",
    estado: sub?.estado ?? null,
    pruebaVencida: prueba.estado === "ok" ? prueba.data.vencida : null,
  });

  // ── Stripe: cobros del hotel y suscripción del dueño ──────────────────────
  // Van después del Promise.all de arriba y en paralelo entre sí. `getConnectState`
  // es la MISMA fuente que usa el checkout del motor: si su cache tiene más de
  // 24 h le pregunta a Stripe en vivo (y lo vuelve a guardar).
  const customerId = sub?.stripe_customer_id ?? null;
  const [cobros, stripe] = await Promise.all([
    (async (): Promise<Bloque<CobrosFicha>> => {
      if (h.stripe_account_id && !stripeEnvReady) {
        return { estado: "error", detalle: "Este entorno no tiene la llave de Stripe: no se puede comprobar." };
      }
      try {
        const c = await conTope(getConnectState(h.id, h.stripe_account_id), 10_000);
        // `getConnectState` NUNCA lanza: cuando Stripe no contesta y no hay cache
        // devuelve `CONNECT_NONE`, que es EXACTAMENTE lo mismo que «este hotel
        // nunca conectó su Stripe». Con un `stripe_account_id` guardado eso es
        // mentira —sí conectó, lo que pasó es que no se pudo comprobar— y encima
        // arrastra al motor: `decidirModoPrueba` con `cobrosListos: false` diría
        // «simula el pago» de un hotel que quizá está cobrando de verdad en su
        // propia cuenta. Un fallo de lectura no se pinta como «no tiene».
        if (h.stripe_account_id && !c.accountId) {
          return {
            estado: "error",
            detalle: "Tiene cuenta de Stripe, pero Stripe no contestó y no hay dato guardado: no se puede decir si ya cobra.",
          };
        }
        return {
          estado: "ok",
          data: {
            accountId: c.accountId,
            chargesEnabled: Boolean(c.chargesEnabled && c.accountId),
            payoutsEnabled: c.payoutsEnabled,
            onboardingStatus: c.onboardingStatus,
            requirementsDue: c.requirementsDue,
          },
        };
      } catch {
        return { estado: "error", detalle: "Stripe no contestó a tiempo." };
      }
    })(),
    (async (): Promise<Bloque<SuscripcionStripe | null> | null> => {
      if (!customerId) return null;
      const r = await suscripcionesStripe();
      if (r.ok) return { estado: "ok", data: r.data.get(customerId) ?? null };
      if (r.data.has(customerId)) {
        return { estado: "ok", data: r.data.get(customerId) ?? null, aviso: "La lista de Stripe vino incompleta." };
      }
      return {
        estado: "error",
        detalle:
          r.error === "sin-stripe"
            ? "Este entorno no tiene la llave de Stripe."
            : r.error === "recortado"
              ? // Stripe SÍ contestó: son tantas suscripciones que la lista se
                // cortó antes de llegar a ésta. Decir «no contestó» mandaría a
                // buscar una avería que no existe.
                "Hay tantas suscripciones en Stripe que la lista se cortó y ésta no venía. Míralo en Stripe."
              : "Stripe no contestó.",
      };
    })(),
  ]);

  // ── Motor en modo prueba ──────────────────────────────────────────────────
  // Con la MISMA lectura de Connect de la tarjeta de cobros, igual que hace el
  // checkout del motor (`decidirModoPrueba` + `getConnectState` una sola vez).
  // La primera versión llamaba a `motorEnModoPrueba`, que vuelve a pedir
  // Connect: con Stripe lento la ficha esperaba dos topes seguidos, y si la
  // primera lectura se cortaba por tiempo y la segunda no, la ficha podía decir
  // a la vez «no puede cobrar» y «no simula».
  let modoPrueba: Bloque<boolean>;
  if (lecturaSusc.estado !== "ok" || !acceso) {
    modoPrueba = {
      estado: "error",
      detalle: acceso ? "Sin leer el plan del dueño no se puede saber." : "No se pudo calcular su acceso.",
    };
  } else if (!decidirModoPrueba({ acceso, cobrosListos: false, demo })) {
    // Tiene plan o cortesía, está bloqueado, es demo o su prueba venció: la
    // respuesta es «no» sin mirar Stripe.
    modoPrueba = { estado: "ok", data: false };
  } else if (cobros.estado === "ok") {
    modoPrueba = {
      estado: "ok",
      data: decidirModoPrueba({ acceso, cobrosListos: cobros.data.chargesEnabled, demo }),
    };
  } else {
    modoPrueba = { estado: "error", detalle: "Sin saber si su Stripe puede cobrar no se puede decir." };
  }

  // ── Camila ────────────────────────────────────────────────────────────────
  const runtime: Bloque<EstadoCamila | null> = camila.ok
    ? { estado: "ok", data: camila.data.get(h.slug) ?? null }
    : { estado: "error", detalle: detalleCamila(camila.error) };
  const cfg = (h.config ?? {}) as Record<string, unknown>;

  // ── Saldo ─────────────────────────────────────────────────────────────────
  let saldo: Bloque<SaldoFicha>;
  if (saldos.error === "falta-sql") {
    saldo = { estado: "falta-sql", archivo: "sql/kora-saldo-bot.sql" };
  } else if (!saldos.ok && !(saldos.error ?? "").startsWith("consumo-incompleto")) {
    saldo = { estado: "error", detalle: "No se pudo leer el saldo." };
  } else {
    const s: SaldoDeHotel | undefined = saldos.data.get(h.id);
    saldo = {
      estado: "ok",
      data: { enPrepago: Boolean(s), mensajes: s?.mensajes ?? null, consumo30d: s?.consumo30d ?? null },
    };
  }

  // ── Bitácora ──────────────────────────────────────────────────────────────
  const bitacoraBloque: Bloque<FilaBitacora[]> = bitacora.faltaSql
    ? { estado: "falta-sql", archivo: "sql/kora-crm-mando.sql" }
    : bitacora.ok
      ? { estado: "ok", data: bitacora.filas }
      : { estado: "error", detalle: "No se pudo leer la bitácora." };

  return {
    tipo: "ok",
    ficha: {
      hotel: {
        id: h.id,
        slug: h.slug,
        nombre: h.nombre,
        ownerId: h.owner_id,
        ubicacion: h.ubicacion ?? null,
        whatsapp: h.whatsapp ?? null,
        publicado: h.publicado !== false,
        createdAt: h.created_at,
        demo,
        bloqueo: bloqueo ? { mensaje: bloqueo.mensaje ?? null, fecha: bloqueo.fecha ?? null } : null,
      },
      otrosHoteles,
      dueno,
      situacion,
      plan,
      stripe,
      prueba,
      cobros,
      modoPrueba,
      camila: {
        runtime,
        // Sin acceso calculado se listan los demás motivos y la ficha avisa de
        // que el del acceso no se pudo comprobar (no se inventa ni un «sí» ni un «no»).
        motivos: motivosSinBot(h, acceso ? acceso.activo : true),
        accesoLeido: Boolean(acceso),
        botEncendido: cfg.bot_enabled !== false,
      },
      saldo,
      fases,
      reservas,
      bitacora: bitacoraBloque,
      enlaces: {
        sitio: `/h/${h.slug}`,
        motor: `/h/${h.slug}/reservar`,
        stripeCliente: customerId ? urlPanelStripe(`/customers/${encodeURIComponent(customerId)}`) : null,
        stripeCuenta: h.stripe_account_id
          ? urlPanelStripe(`/connect/accounts/${encodeURIComponent(h.stripe_account_id)}`)
          : null,
      },
      ventanaDias: VENTANA_DIAS,
    },
  };
}

// ─── La lista ────────────────────────────────────────────────────────────────

export interface FilaHotelLista {
  id: string;
  slug: string;
  nombre: string;
  publicado: boolean;
  createdAt: string | null;
  ownerEmail: string | null;
  /** null = no se pudo saber (no se leyó el plan). */
  situacion: SituacionHotel | null;
  diasPrueba: number | null;
  cobrosListos: boolean;
  /** null = sin sesión en el servidor de Camila. */
  camila: EstadoCamila | null;
  /** null = fuera del prepago (≠ saldo 0). */
  saldo: SaldoDeHotel | null;
}

export interface ListaHoteles {
  hoteles: FilaHotelLista[];
  /** false = esa columna NO es de fiar y la pantalla lo tiene que decir. */
  lecturas: { hoteles: boolean; correos: boolean; situacion: boolean; cobros: boolean; camila: boolean; saldo: boolean };
  /** Lecturas que fallaron de verdad (banda roja). */
  fallos: string[];
  /** SQL o configuración pendiente (nota gris). */
  pendientes: string[];
}

interface FilaHotelMin {
  id: string;
  slug: string;
  nombre: string;
  owner_id: string;
  publicado: boolean | null;
  extras: Record<string, unknown> | null;
  created_at: string | null;
}

const TOPE_LISTA = 20_000;

type LecturaPruebas =
  | { estado: "ok"; mapa: Map<string, { inicio: string; diasExtra: number }>; faltaTabla: boolean }
  | { estado: "error" };

/**
 * El ancla y los días extra de TODOS los dueños, sin tragarse el error.
 *
 * La lista usaba `anclasPruebaDeDuenos` (lib/db/prueba-dueno.ts), que ante un
 * fallo devuelve el mapa vacío sin decirlo. Con eso cada hotel caía a su
 * `created_at`: quien borró y recreó su hotel salía «En prueba · 12 d» con la
 * prueba vencida, y a quien se le regalaron días le faltaban. Es un número
 * falso en la columna con la que se decide a quién alargarle la prueba. Aquí un
 * fallo es un fallo, y la columna lo dice.
 *
 * Se lee la tabla entera (una fila por dueño) en vez de `.in(ids)`: con cientos
 * de dueños la lista de ids no cabe en la URL.
 */
async function leerPruebasDeTodos(admin: ReturnType<typeof createAdminClient>): Promise<LecturaPruebas> {
  const mapa = new Map<string, { inicio: string; diasExtra: number }>();
  const leer = (columnas: string) =>
    leerPaginado<{ user_id: string; inicio: string | null; dias_extra?: unknown }>(
      (desde, hasta, contar) =>
        admin
          .from("pruebas")
          .select(columnas, contar ? { count: "exact" as const } : undefined)
          .order("user_id", { ascending: true })
          .range(desde, hasta),
      TOPE_LISTA,
    );

  let r = await leer("user_id, inicio, dias_extra");
  if (r.error && sinColumna(r.error, "dias_extra")) r = await leer("user_id, inicio");
  if (r.error) {
    if (noExiste(r.error) && !sinColumna(r.error, "inicio")) return { estado: "ok", mapa, faltaTabla: true };
    console.error("[crm/ficha] no se pudieron leer las pruebas de los dueños:", r.error.message);
    return { estado: "error" };
  }
  if (r.recortadas) return { estado: "error" };
  for (const f of r.filas) {
    if (f?.user_id && f?.inicio) mapa.set(f.user_id, { inicio: f.inicio, diasExtra: diasExtraSanos(f.dias_extra) });
  }
  return { estado: "ok", mapa, faltaTabla: false };
}

/**
 * Todos los hoteles con lo que hace falta para decidir a cuál entrar. NUNCA
 * lanza. Si no se pueden leer los hoteles, la lista viene vacía CON un fallo:
 * la pantalla dice «no se pudieron leer», nunca «no hay hoteles».
 */
export async function cargarListaHoteles(): Promise<ListaHoteles> {
  try {
    return await cargarLista();
  } catch (e) {
    console.error("[crm/ficha] la lista de hoteles falló:", e);
    return {
      hoteles: [],
      lecturas: { hoteles: false, correos: false, situacion: false, cobros: false, camila: false, saldo: false },
      fallos: ["No se pudieron leer los hoteles. Recarga en un momento."],
      pendientes: [],
    };
  }
}

async function cargarLista(): Promise<ListaHoteles> {
  const fallos: string[] = [];
  const pendientes: string[] = [];
  const lecturas = { hoteles: false, correos: false, situacion: false, cobros: false, camila: false, saldo: false };

  if (!adminEnvReady) {
    fallos.push("No hay conexión a la base de datos (falta SUPABASE_SERVICE_ROLE_KEY).");
    return { hoteles: [], lecturas, fallos, pendientes };
  }

  const admin = createAdminClient();
  const [rHoteles, rSusc, rPruebas, usuarios, cobros, camila, saldos] = await Promise.all([
    leerPaginado<FilaHotelMin>(
      (desde, hasta, contar) =>
        admin
          .from("hoteles")
          .select("id, slug, nombre, owner_id, publicado, extras, created_at", contar ? { count: "exact" as const } : undefined)
          .order("created_at", { ascending: false })
          .order("id", { ascending: true })
          .range(desde, hasta),
      TOPE_LISTA,
    ),
    leerPaginado<{ user_id: string; estado: EstadoSuscripcion; periodo_fin: string | null }>(
      (desde, hasta, contar) =>
        admin
          .from("suscripciones")
          .select("user_id, estado, periodo_fin", contar ? { count: "exact" as const } : undefined)
          .order("user_id", { ascending: true })
          .range(desde, hasta),
      TOPE_LISTA,
    ),
    leerPruebasDeTodos(admin),
    todosLosUsuarios(),
    cobrosPorHotel(),
    estadoCamilaTodos(),
    saldosPorHotel(),
  ]);

  if (rHoteles.error) {
    if (noExiste(rHoteles.error)) {
      pendientes.push("Falta correr sql/kora-fase4-schema.sql: todavía no existe la tabla de hoteles.");
    } else {
      console.error("[crm/ficha] no se pudieron leer los hoteles:", rHoteles.error.message);
      fallos.push("No se pudieron leer los hoteles. Recarga en un momento.");
    }
    return { hoteles: [], lecturas, fallos, pendientes };
  }
  lecturas.hoteles = true;
  if (rHoteles.recortadas) {
    fallos.push(`Sólo se leyeron los ${rHoteles.filas.length.toLocaleString("es-MX")} hoteles más nuevos: faltan los más viejos.`);
  }

  // Una lista de planes recortada NO es de fiar: el dueño que quedó fuera saldría
  // «en prueba» aunque pague.
  lecturas.situacion = !rSusc.error && !rSusc.recortadas;
  if (rSusc.error) {
    if (noExiste(rSusc.error)) {
      pendientes.push(`Falta correr ${SQL_SUSCRIPCIONES}: sin él no se sabe quién paga.`);
    } else {
      console.error("[crm/ficha] no se pudieron leer las suscripciones:", rSusc.error.message);
      fallos.push("No se pudieron leer los planes: la situación de cada hotel queda sin saber.");
    }
  } else if (rSusc.recortadas) {
    fallos.push("La lista de planes vino incompleta: la situación de cada hotel queda sin saber.");
  }

  if (rPruebas.estado === "error") {
    fallos.push("No se pudo leer cuándo empezó la prueba de cada dueño: los que no tienen plan salen sin situación.");
  } else if (rPruebas.faltaTabla) {
    pendientes.push("Falta correr sql/kora-prueba-por-dueno.sql: la prueba se cuenta desde el alta de cada hotel.");
  }

  lecturas.correos = usuarios.ok;
  if (!usuarios.ok) fallos.push("No se pudieron leer todos los correos de los dueños: algunos pueden faltar.");

  lecturas.cobros = cobros.ok;
  if (!cobros.ok) {
    if (cobros.error === "falta-sql") {
      pendientes.push("Falta correr sql/kora-pagos-fase3.sql: sin él no se sabe qué hotel puede cobrar.");
    } else {
      fallos.push("No se pudo leer qué hoteles pueden cobrar con Stripe.");
    }
  }

  lecturas.camila = camila.ok;
  if (!camila.ok) {
    if (camila.error === "sin-runtime") pendientes.push("Este entorno no tiene configurado el servidor de Camila.");
    else fallos.push(`No se pudo leer el estado de Camila: ${detalleCamila(camila.error).toLowerCase()}`);
  }

  lecturas.saldo = saldos.ok || (saldos.error ?? "").startsWith("consumo-incompleto");
  if (!saldos.ok) {
    if (saldos.error === "falta-sql") pendientes.push("Falta correr sql/kora-saldo-bot.sql: todavía no hay prepago.");
    else if (lecturas.saldo) fallos.push("No se pudo contar el consumo de mensajes de algunos hoteles.");
    else fallos.push("No se pudo leer el saldo de Camila.");
  }

  const filas = rHoteles.filas;
  const subs = new Map(rSusc.filas.map((s) => [s.user_id, s]));
  const correos = new Map(usuarios.data.map((u) => [u.id, u.email]));
  const anclas = rPruebas.estado === "ok" ? rPruebas.mapa : null;

  const hoteles: FilaHotelLista[] = filas.map((h) => {
    const extras = h.extras ?? {};
    const demo = (extras as { demo?: unknown }).demo === true;
    const sub = subs.get(h.owner_id) ?? null;
    const ancla = anclas?.get(h.owner_id);
    // Sin las anclas no se calcula la prueba: con el `created_at` a secas saldría
    // un número de días que no es el que tiene (ver `leerPruebasDeTodos`).
    const prueba = anclas ? pruebaDelHotel(h, ancla?.inicio ?? null, ancla?.diasExtra ?? 0) : null;
    const situacion = situacionHotel({
      bloqueado: Boolean(bloqueoDelHotel(extras)),
      demo,
      suscripcionLeida: lecturas.situacion,
      estado: sub?.estado ?? null,
      // `pruebaDelHotel` sólo da null con un demo, que ya decidió arriba; null
      // aquí es «no se pudieron leer las anclas» y la situación queda sin saber.
      pruebaVencida: anclas ? (prueba ? prueba.vencida : true) : null,
    });
    return {
      id: h.id,
      slug: h.slug,
      nombre: h.nombre,
      publicado: h.publicado !== false,
      createdAt: h.created_at,
      ownerEmail: correos.get(h.owner_id) ?? null,
      situacion,
      diasPrueba: situacion === "prueba" && prueba ? prueba.diasRestantes : null,
      cobrosListos: cobros.data.get(h.id)?.chargesEnabled === true,
      camila: camila.data.get(h.slug) ?? null,
      saldo: saldos.data.get(h.id) ?? null,
    };
  });

  return { hoteles, lecturas, fallos, pendientes };
}
