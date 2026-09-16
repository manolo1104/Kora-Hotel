// Lectores de las fuentes que el CRM no miraba: todos los usuarios, el estado
// real de Camila, los cobros de Stripe Connect, el saldo prepago y las
// suscripciones tal como las ve Stripe. SOLO servidor (service-role y llave de
// Stripe): en componentes cliente, sólo `import type`.
//
// ── EL CONTRATO DE CADA LECTOR ───────────────────────────────────────────────
//
// Todos devuelven `{ ok, data, error? }` y NINGUNO lanza. Es la regla heredada de
// lib/crm/operaciones.ts: el silencio y el cero tienen que verse distintos.
// `ok: false` con `data` vacío significa «no pude leer», NUNCA «no hay nada», y
// la pantalla tiene que decirlo. `error: 'falta-sql'` es la nota gris de «esa
// tabla aún no existe»; cualquier otro error es la banda roja.
//
// Lo externo (runtime de Railway, Stripe) va con un tope de espera corto: la
// vista del fundador no puede quedarse en blanco porque Railway no contesta.

import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { getStripe, stripeEnvReady } from "@/lib/stripe/server";

export type Lectura<T> = { ok: boolean; data: T; error?: string };

const TABLA_AUSENTE = new Set(["42P01", "PGRST205"]);

function esTablaAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && TABLA_AUSENTE.has(error.code)) return true;
  return /Could not find the table|relation .* does not exist/i.test(error.message ?? "");
}

function mensaje(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Rechaza si `p` no termina en `ms`. No cancela la operación, sólo deja de esperarla. */
function conTope<T>(p: PromiseLike<T>, ms: number, etiqueta: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tope = new Promise<never>((_, rechazar) => {
    timer = setTimeout(() => rechazar(new Error(`${etiqueta}: sin respuesta en ${ms} ms`)), ms);
  });
  return Promise.race([Promise.resolve(p), tope]).finally(() => clearTimeout(timer));
}

// ─── Usuarios ────────────────────────────────────────────────────────────────

export interface UsuarioKora {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

const USUARIOS_POR_PAGINA = 1000;
// 50 000 cuentas. Si algún día se llega, la lectura dice `ok: false` en vez de
// quedarse paginando para siempre.
const USUARIOS_PAGINAS_MAX = 50;

/**
 * Todas las cuentas de Supabase Auth. Incluye a quien se registró y nunca creó
 * hotel —que hoy no aparece en ningún lado— y también al personal que un dueño
 * dio de alta en su equipo: quien use esto para «registrados sin hotel» tiene
 * que restar dueños Y miembros de `hotel_members`.
 *
 * Antes el CRM leía sólo la primera página de 200 (lib/crm/operaciones.ts): con
 * más cuentas, empezaban a faltar correos sin que nada lo dijera.
 */
export async function todosLosUsuarios(): Promise<Lectura<UsuarioKora[]>> {
  const usuarios: UsuarioKora[] = [];
  if (!adminEnvReady) return { ok: false, data: usuarios, error: "sin-base" };
  try {
    const admin = createAdminClient();
    for (let page = 1; page <= USUARIOS_PAGINAS_MAX; page++) {
      const { data, error } = await conTope(
        admin.auth.admin.listUsers({ page, perPage: USUARIOS_POR_PAGINA }),
        8_000,
        "listUsers",
      );
      if (error) {
        console.error("[crm/fuentes] no se pudieron leer los usuarios:", error.message);
        // Lo leído hasta aquí se devuelve, pero marcado como incompleto.
        return { ok: false, data: usuarios, error: error.message };
      }
      const lote = data?.users ?? [];
      for (const u of lote) {
        usuarios.push({
          id: u.id,
          email: u.email ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          email_confirmed_at: u.email_confirmed_at ?? null,
        });
      }
      if (lote.length < USUARIOS_POR_PAGINA) return { ok: true, data: usuarios };
    }
    return { ok: false, data: usuarios, error: "demasiados-usuarios" };
  } catch (e) {
    console.error("[crm/fuentes] error leyendo los usuarios:", e);
    return { ok: false, data: usuarios, error: mensaje(e) };
  }
}

// ─── Camila (runtime de Railway) ─────────────────────────────────────────────

export interface EstadoCamila {
  /**
   * Lo que dice el runtime, TAL CUAL. Los que escribe de verdad
   * (agentes/camila/index.js) son exactamente estos siete:
   *
   *   'starting'      arrancando la sesión
   *   'qr'            esperando a que alguien escanee el código
   *   'ready'         conectada y contestando
   *   'auth_failure'  WhatsApp rechazó la sesión
   *   'disconnected'  se cayó la sesión
   *   'error'         reventó al arrancar o al contestar
   *   'sin-vincular'  el hotel está en el fleet y nunca se vinculó
   *
   * No son 'listo' ni 'iniciando', que es lo que decía este comentario antes:
   * quien lo copiara para otra pantalla escribiría estados que nunca llegan.
   * `tipoCamila` (lib/crm/operaciones.ts) y `chipCamila`
   * (components/crm/FichaHotel.tsx) mapean estos siete.
   */
  status: string;
  /** Motivo, sólo cuando `status` es 'error'. */
  err: string | null;
}

/**
 * El estado de WhatsApp de TODOS los hoteles, de una sola llamada.
 *
 * Mismo camino que `app/api/admin/bot-status` (CAMILA_RUNTIME_URL +
 * `Authorization: Bearer $BOT_FLEET_SECRET`), pero sin `?slug=`: así el runtime
 * devuelve la lista entera (`agentes/camila/servidor.js`, ruta /estado) en vez
 * de una llamada por hotel.
 *
 * El QR que devuelve el runtime se DESCARTA aquí: es la credencial para
 * emparejar el número de un hotel y el CRM no tiene nada que hacer con él.
 *
 * Un hotel que no está en el mapa no tiene sesión en el runtime (fuera del fleet
 * o todavía arrancando): eso no es un error de lectura.
 */
export async function estadoCamilaTodos(): Promise<Lectura<Map<string, EstadoCamila>>> {
  const mapa = new Map<string, EstadoCamila>();
  const base = process.env.CAMILA_RUNTIME_URL;
  const secreto = process.env.BOT_FLEET_SECRET;
  if (!base || !secreto) return { ok: false, data: mapa, error: "sin-runtime" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/estado`, {
      headers: { Authorization: `Bearer ${secreto}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, data: mapa, error: `runtime-${res.status}` };
    const cuerpo = (await res.json().catch(() => null)) as { hotels?: unknown } | null;
    if (!cuerpo || !Array.isArray(cuerpo.hotels)) {
      return { ok: false, data: mapa, error: "respuesta-ilegible" };
    }
    for (const h of cuerpo.hotels as Array<Record<string, unknown>>) {
      const slug = typeof h?.slug === "string" ? h.slug : "";
      if (!slug) continue;
      mapa.set(slug, {
        status: typeof h.status === "string" ? h.status : "desconocido",
        err: typeof h.err === "string" ? h.err : null,
      });
    }
    return { ok: true, data: mapa };
  } catch {
    // Timeout o red: el runtime no contestó. No es un fallo del CRM, pero la
    // pantalla no puede pintar «Camila sin conectar» a partir de esto.
    return { ok: false, data: mapa, error: "sin-respuesta" };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Cobros (Stripe Connect) ─────────────────────────────────────────────────

export interface CobrosHotel {
  /** La cuenta conectada que tiene el hotel HOY (`hoteles.stripe_account_id`). */
  accountId: string | null;
  /** Puede cobrar ya. Es el dato que decide si el dinero entra al hotel o a Kora. */
  chargesEnabled: boolean;
  /** 'pendiente' | 'verificado' | 'requiere_info', o null si no hay dato. */
  onboardingStatus: string | null;
  /** Cuándo se refrescó el dato en el cache. Viejo (>24 h) = puede haber cambiado. */
  actualizado: string | null;
}

/**
 * Estado de cobro de cada hotel, desde el cache `hotel_stripe_accounts` que
 * mantienen el webhook `account.updated` y el panel de Pagos. No llama a Stripe
 * en vivo (serían N llamadas por carga del CRM); `actualizado` dice de cuándo es.
 *
 * Trae TODOS los hoteles, no sólo los que tienen fila en el cache. Y la etiqueta
 * vieja del CRM («con Stripe» = tiene `stripe_account_id`) mentía justo en el
 * caso caro: una cuenta a medias tiene id y NO cobra, y el dinero cae en Kora.
 *
 * Igual que `getConnectState`, si la cuenta del cache no es la que tiene el
 * hotel ahora (se reconectó), el cache no vale y cuenta como no listo.
 */
export async function cobrosPorHotel(): Promise<Lectura<Map<string, CobrosHotel>>> {
  const mapa = new Map<string, CobrosHotel>();
  if (!adminEnvReady) return { ok: false, data: mapa, error: "sin-base" };
  try {
    const admin = createAdminClient();
    const [rHoteles, rCache] = await Promise.all([
      admin.from("hoteles").select("id, stripe_account_id"),
      admin
        .from("hotel_stripe_accounts")
        .select("hotel_id, stripe_account_id, charges_enabled, onboarding_status, updated_at"),
    ]);

    if (rHoteles.error) {
      console.error("[crm/fuentes] no se pudieron leer los hoteles para cobros:", rHoteles.error.message);
      return { ok: false, data: mapa, error: rHoteles.error.message };
    }

    const cache = new Map<
      string,
      { stripe_account_id: string; charges_enabled: boolean; onboarding_status: string | null; updated_at: string | null }
    >();
    for (const f of (rCache.data ?? []) as Array<{
      hotel_id: string;
      stripe_account_id: string;
      charges_enabled: boolean;
      onboarding_status: string | null;
      updated_at: string | null;
    }>) {
      if (f?.hotel_id) cache.set(f.hotel_id, f);
    }

    for (const h of (rHoteles.data ?? []) as Array<{ id: string; stripe_account_id: string | null }>) {
      const cuenta = h.stripe_account_id ?? null;
      const fila = cuenta ? cache.get(h.id) : undefined;
      const vale = Boolean(fila && fila.stripe_account_id === cuenta);
      mapa.set(h.id, {
        accountId: cuenta,
        chargesEnabled: vale ? fila!.charges_enabled === true : false,
        onboardingStatus: vale ? (fila!.onboarding_status ?? null) : null,
        actualizado: vale ? (fila!.updated_at ?? null) : null,
      });
    }

    if (rCache.error) {
      // Sin el cache, cada hotel sale «no listo» aunque quizá sí lo esté: la
      // pantalla tiene que avisarlo en vez de pintar a todos sin cobros.
      if (esTablaAusente(rCache.error)) return { ok: false, data: mapa, error: "falta-sql" };
      console.error("[crm/fuentes] no se pudo leer el cache de Connect:", rCache.error.message);
      return { ok: false, data: mapa, error: rCache.error.message };
    }
    return { ok: true, data: mapa };
  } catch (e) {
    console.error("[crm/fuentes] error leyendo los cobros:", e);
    return { ok: false, data: mapa, error: mensaje(e) };
  }
}

// ─── Saldo prepago de Camila ─────────────────────────────────────────────────

export interface SaldoDeHotel {
  /** Mensajes que le quedan. */
  mensajes: number;
  /** Mensajes gastados en los últimos 30 días. null = no se pudo contar (NO es cero). */
  consumo30d: number | null;
}

/** Cuántas consultas de conteo van a la vez. Con decenas de hoteles, sobra. */
const CONTEOS_A_LA_VEZ = 8;

/**
 * Saldo y consumo de 30 días de cada hotel dado de alta en el prepago.
 *
 * Un hotel SIN fila en `saldo_bot` no aparece en el mapa, y eso NO es «sin
 * saldo»: es «no está en el prepago» (lib/db/saldo.ts, `sinSaldo`). A ese hotel
 * nunca se le calla. La pantalla tiene que distinguirlo de un 0.
 *
 * El consumo se cuenta hotel por hotel con `count` de cabecera (no se traen las
 * filas): cada mensaje de Camila deja un renglón, y traerlos todos para sumarlos
 * serían decenas de miles de filas por carga del CRM.
 */
export async function saldosPorHotel(): Promise<Lectura<Map<string, SaldoDeHotel>>> {
  const mapa = new Map<string, SaldoDeHotel>();
  if (!adminEnvReady) return { ok: false, data: mapa, error: "sin-base" };
  try {
    const admin = createAdminClient();
    // CON `count: 'exact'`: PostgREST corta cada respuesta en su tope de filas
    // (1 000 en Supabase) SIN avisar. `leerSaldosCrudos` (lib/saldo/prepago-crm.ts)
    // ya lo comprobaba y este lector no: con más de 1 000 hoteles en el prepago,
    // los contadores de /crm y de /crm/prepago («en el prepago», «en cero hoy»,
    // «recarga de seguridad») saldrían cortos en silencio, y la pantalla diría
    // «hecha» mientras el candado del servidor —que usa el lector que sí lo
    // comprueba— seguiría rechazando encender el bloqueo.
    const { data, error, count } = await admin
      .from("saldo_bot")
      .select("hotel_id, mensajes", { count: "exact" });
    if (error) {
      if (esTablaAusente(error)) return { ok: false, data: mapa, error: "falta-sql" };
      console.error("[crm/fuentes] no se pudo leer el saldo:", error.message);
      return { ok: false, data: mapa, error: error.message };
    }

    const filas = (data ?? []) as Array<{ hotel_id: string; mensajes: number | null }>;
    if (typeof count === "number" && count > filas.length) {
      console.error(`[crm/fuentes] saldo_bot: llegaron ${filas.length} de ${count} filas; se trata como no leído.`);
      return { ok: false, data: mapa, error: "recortado" };
    }
    for (const f of filas) {
      if (!f?.hotel_id) continue;
      mapa.set(f.hotel_id, {
        mensajes: typeof f.mensajes === "number" ? f.mensajes : 0,
        consumo30d: null,
      });
    }

    const desde = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const ids = [...mapa.keys()];
    let conteosFallidos = 0;
    for (let i = 0; i < ids.length; i += CONTEOS_A_LA_VEZ) {
      await Promise.all(
        ids.slice(i, i + CONTEOS_A_LA_VEZ).map(async (hotelId) => {
          try {
            const { count, error: e } = await admin
              .from("saldo_movimientos")
              .select("id", { count: "exact", head: true })
              .eq("hotel_id", hotelId)
              .eq("tipo", "consumo")
              .gte("created_at", desde);
            if (e || typeof count !== "number") {
              conteosFallidos++;
              return;
            }
            const s = mapa.get(hotelId);
            if (s) s.consumo30d = count;
          } catch {
            conteosFallidos++;
          }
        }),
      );
    }

    if (conteosFallidos > 0) {
      return { ok: false, data: mapa, error: `consumo-incompleto (${conteosFallidos} de ${ids.length})` };
    }
    return { ok: true, data: mapa };
  } catch (e) {
    console.error("[crm/fuentes] error leyendo el saldo:", e);
    return { ok: false, data: mapa, error: mensaje(e) };
  }
}

// ─── Suscripciones, según Stripe ─────────────────────────────────────────────

export interface SuscripcionStripe {
  subscriptionId: string;
  /** El estado de Stripe tal cual: 'active', 'trialing', 'past_due', 'canceled'… */
  status: string;
  /**
   * Lo que se cobra al MES, en pesos, a precio de lista (suma de los conceptos,
   * pasando a mensual los que son anuales o semanales). NO descuenta cupones:
   * para ingreso real hay que mirar las facturas. null si no es en MXN o no se
   * puede calcular.
   */
  montoMxn: number | null;
  /** ISO del fin de la prueba en Stripe, o null. */
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const SUSCRIPCIONES_MAX = 1_000;

/** Qué suscripción representa a un cliente si tiene varias (una vieja cancelada y una viva). */
const PRIORIDAD_STATUS: Record<string, number> = {
  active: 0,
  trialing: 1,
  past_due: 2,
  unpaid: 3,
  paused: 4,
  incomplete: 5,
  incomplete_expired: 6,
  canceled: 7,
};

type ItemStripe = {
  quantity?: number | null;
  price?: {
    unit_amount: number | null;
    currency: string;
    recurring: { interval: string; interval_count: number } | null;
  } | null;
};

/** Monto mensual en pesos de los conceptos de una suscripción. Exportada para probarla. */
export function montoMensualMxn(items: ItemStripe[]): number | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  let centavos = 0;
  for (const it of items) {
    const p = it?.price;
    if (!p || p.currency?.toLowerCase() !== "mxn" || typeof p.unit_amount !== "number" || !p.recurring) {
      return null;
    }
    const cada = Math.max(1, p.recurring.interval_count || 1);
    const porMes: Record<string, number> = { month: 1, year: 1 / 12, week: 52 / 12, day: 365 / 12 };
    const factor = porMes[p.recurring.interval];
    if (factor === undefined) return null;
    centavos += (p.unit_amount * Math.max(1, it.quantity ?? 1) * factor) / cada;
  }
  return Math.round(centavos) / 100;
}

/**
 * Las suscripciones de Kora como las ve STRIPE, por cliente.
 *
 * Existe porque la tabla `suscripciones` y el MRR del CRM no bastan: el webhook
 * guarda como `activa` a quien está en la prueba de Stripe (`trialing`), así que
 * ahí «pagando» incluye a gente que todavía no ha pagado nada. Aquí `status` y
 * `trialEnd` lo dicen tal cual.
 *
 * Lee todos los estados (`status: 'all'`), de 100 en 100, hasta 1 000.
 */
export async function suscripcionesStripe(): Promise<Lectura<Map<string, SuscripcionStripe>>> {
  const mapa = new Map<string, SuscripcionStripe>();
  if (!stripeEnvReady) return { ok: false, data: mapa, error: "sin-stripe" };
  try {
    const lista = await conTope(
      getStripe()
        .subscriptions.list({ status: "all", limit: 100 }, { timeout: 8_000 })
        .autoPagingToArray({ limit: SUSCRIPCIONES_MAX }),
      15_000,
      "stripe.subscriptions",
    );

    const creadaPorCliente = new Map<string, number>();
    for (const s of lista) {
      const customerId = typeof s.customer === "string" ? s.customer : s.customer?.id;
      if (!customerId) continue;

      const previa = mapa.get(customerId);
      if (previa) {
        const pNueva = PRIORIDAD_STATUS[s.status] ?? 9;
        const pPrevia = PRIORIDAD_STATUS[previa.status] ?? 9;
        const masNueva = s.created > (creadaPorCliente.get(customerId) ?? 0);
        if (pNueva > pPrevia || (pNueva === pPrevia && !masNueva)) continue;
      }

      creadaPorCliente.set(customerId, s.created);
      mapa.set(customerId, {
        subscriptionId: s.id,
        status: s.status,
        montoMxn: montoMensualMxn((s.items?.data ?? []) as unknown as ItemStripe[]),
        trialEnd: typeof s.trial_end === "number" ? new Date(s.trial_end * 1000).toISOString() : null,
        cancelAtPeriodEnd: s.cancel_at_period_end === true,
      });
    }

    if (lista.length >= SUSCRIPCIONES_MAX) {
      return { ok: false, data: mapa, error: "recortado" };
    }
    return { ok: true, data: mapa };
  } catch (e) {
    console.error("[crm/fuentes] no se pudieron leer las suscripciones de Stripe:", e);
    return { ok: false, data: mapa, error: "sin-respuesta" };
  }
}
