// Lo que lee y escribe /crm/prepago. SOLO servidor (service-role): la pantalla
// sólo puede hacer `import type` de aquí, y las reglas que comparte con el
// navegador viven en lib/saldo/candados.ts.
//
// Sustituye a lo que hasta el 15 sep 2026 se hacía con scripts/regalar-saldo.mjs
// y con las variables SALDO_RECARGA / SALDO_BLOQUEO de Vercel.
//
// ── EL SILENCIO Y EL CERO SE VEN DISTINTOS ───────────────────────────────────
//
// Misma regla que lib/crm/operaciones.ts y lib/crm/fuentes.ts: nada de aquí
// lanza, y lo que no se pudo leer sale como `null` o como `leida: false`, nunca
// como 0. En esta pantalla importa más que en ninguna: «0 hoteles se quedarían
// mudos» leído de una consulta que falló es lo que haría encender el bloqueo a
// ciegas.

import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { saldosPorHotel } from "@/lib/crm/fuentes";
import { fasesSaldo, invalidarCacheFases } from "@/lib/saldo/fases";
import { diasQueAlcanzan } from "@/lib/saldo/paquetes";
import { acreditarMensajes, SIN_DATO } from "@/lib/db/saldo";
import {
  ETIQUETA_SEGURIDAD,
  mudosSiSeEnciende,
  refDeRegalo,
  seguridadDelPrepago,
  type HotelPrepago,
  type PanoramaPrepago,
  type SeguridadPrepago,
} from "@/lib/saldo/candados";

const TABLA_AUSENTE = new Set(["42P01", "PGRST205"]);

function esTablaAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && TABLA_AUSENTE.has(error.code)) return true;
  return /Could not find the table|relation .* does not exist/i.test(error.message ?? "");
}

export interface HotelBasico {
  id: string;
  slug: string;
  nombre: string;
}

/**
 * ¿La base devolvió MENOS filas de las que hay? Supabase corta cada consulta en
 * un tope de filas (1.000 por defecto) sin dar error. Aquí eso no es un detalle:
 * una lista de saldos recortada haría que el candado diera la recarga de
 * seguridad por hecha sin mirar a los que quedaron fuera, y un regalo a todos se
 * saltaría hoteles en silencio. Recortada = no leída.
 */
function recortada(count: number | null, filas: number, que: string): boolean {
  if (typeof count === "number" && count > filas) {
    console.error(`[saldo/prepago-crm] ${que}: llegaron ${filas} de ${count} filas; se trata como no leído.`);
    return true;
  }
  return false;
}

/** Todos los hoteles, del más antiguo al más nuevo (el mismo orden que el script). */
export async function leerHoteles(): Promise<{ ok: boolean; data: HotelBasico[] }> {
  if (!adminEnvReady) return { ok: false, data: [] };
  try {
    const { data, error, count } = await createAdminClient()
      .from("hoteles")
      .select("id, slug, nombre", { count: "exact" })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[saldo/prepago-crm] no se pudieron leer los hoteles:", error.message);
      return { ok: false, data: [] };
    }
    if (recortada(count, (data ?? []).length, "hoteles")) return { ok: false, data: [] };
    const filas = (data ?? []) as Array<{ id: string; slug: string | null; nombre: string | null }>;
    return {
      ok: true,
      data: filas
        .filter((h) => h?.id && h.slug)
        .map((h) => ({ id: h.id, slug: h.slug as string, nombre: (h.nombre ?? "").trim() || (h.slug as string) })),
    };
  } catch (e) {
    console.error("[saldo/prepago-crm] error leyendo los hoteles:", e);
    return { ok: false, data: [] };
  }
}

/**
 * El saldo de cada hotel con fila, sin contar el consumo (una sola consulta).
 * Para los candados y el ensayo, que no necesitan las N consultas de conteo de
 * `saldosPorHotel`.
 */
export async function leerSaldosCrudos(): Promise<{ ok: boolean; faltaSql: boolean; data: Map<string, number> }> {
  const data = new Map<string, number>();
  if (!adminEnvReady) return { ok: false, faltaSql: false, data };
  try {
    const {
      data: filas,
      error,
      count,
    } = await createAdminClient().from("saldo_bot").select("hotel_id, mensajes", { count: "exact" });
    if (error) {
      if (esTablaAusente(error)) return { ok: false, faltaSql: true, data };
      console.error("[saldo/prepago-crm] no se pudo leer el saldo:", error.message);
      return { ok: false, faltaSql: false, data };
    }
    if (recortada(count, (filas ?? []).length, "saldo_bot")) return { ok: false, faltaSql: false, data };
    for (const f of (filas ?? []) as Array<{ hotel_id: string; mensajes: number | null }>) {
      if (f?.hotel_id) data.set(f.hotel_id, typeof f.mensajes === "number" ? f.mensajes : 0);
    }
    return { ok: true, faltaSql: false, data };
  } catch (e) {
    console.error("[saldo/prepago-crm] error leyendo el saldo:", e);
    return { ok: false, faltaSql: false, data };
  }
}

/** De cuántos en cuántos se preguntan los hoteles: 100 uuid caben de sobra en una URL. */
const IDS_POR_CONSULTA = 100;

/**
 * Qué hoteles de `ids` ya tienen un movimiento con este `ref`.
 *
 * Se filtra por `hotel_id` Y `ref`, que es justo el índice único
 * `saldo_mov_ref_idx`: la consulta no barre los miles de renglones de consumo.
 * Se mira sólo el `ref`, no el tipo: es lo mismo que mira `saldo_acreditar` para
 * decidir que un regalo es repetido.
 */
export async function hotelesConRef(
  ids: readonly string[],
  ref: string,
): Promise<{ ok: boolean; faltaSql: boolean; ids: Set<string> }> {
  const encontrados = new Set<string>();
  if (!adminEnvReady) return { ok: false, faltaSql: false, ids: encontrados };
  if (ids.length === 0) return { ok: true, faltaSql: false, ids: encontrados };
  try {
    const admin = createAdminClient();
    for (let i = 0; i < ids.length; i += IDS_POR_CONSULTA) {
      const { data, error } = await admin
        .from("saldo_movimientos")
        .select("hotel_id")
        .eq("ref", ref)
        .in("hotel_id", ids.slice(i, i + IDS_POR_CONSULTA));
      if (error) {
        if (esTablaAusente(error)) return { ok: false, faltaSql: true, ids: encontrados };
        console.error("[saldo/prepago-crm] no se pudieron leer los movimientos:", error.message);
        return { ok: false, faltaSql: false, ids: encontrados };
      }
      for (const f of (data ?? []) as Array<{ hotel_id: string }>) if (f?.hotel_id) encontrados.add(f.hotel_id);
    }
    return { ok: true, faltaSql: false, ids: encontrados };
  } catch (e) {
    console.error("[saldo/prepago-crm] error leyendo los movimientos:", e);
    return { ok: false, faltaSql: false, ids: encontrados };
  }
}

/**
 * Lo que necesitan los candados de los interruptores, leído EN EL MOMENTO (sin
 * caché): si está instalado el prepago, cuántos se quedarían mudos y si la
 * recarga de seguridad está completa.
 *
 * `saldoInstalado` sólo es false cuando la tabla NO EXISTE. Si la lectura falló
 * por otra cosa no se sabe, y no se afirma que falte el SQL: la recarga de
 * seguridad sale `leida: false`, y eso ya impide encender el bloqueo.
 */
export async function comprobarSeguridad(): Promise<{
  saldoInstalado: boolean;
  mudosHoy: number | null;
  seguridad: SeguridadPrepago;
}> {
  const saldos = await leerSaldosCrudos();
  if (!saldos.ok) {
    return {
      saldoInstalado: !saldos.faltaSql,
      mudosHoy: null,
      seguridad: { leida: false, total: 0, faltan: [] },
    };
  }
  const conFila = [...saldos.data.keys()];
  const refs = await hotelesConRef(conFila, refDeRegalo(ETIQUETA_SEGURIDAD));
  return {
    saldoInstalado: true,
    mudosHoy: mudosSiSeEnciende([...saldos.data.values()].map((mensajes) => ({ mensajes }))),
    seguridad: refs.ok
      ? seguridadDelPrepago(conFila, refs.ids)
      : { leida: false, total: conFila.length, faltan: [] },
  };
}

/**
 * ¿Existe `kora_ajustes` (sql/kora-crm-mando.sql)? false SÓLO si la tabla no
 * existe. `fasesSaldo()` no lo distingue a propósito (sin tabla manda el entorno,
 * igual que sin fila), pero la pantalla sí tiene que saberlo: sin la tabla, cada
 * clic en un interruptor acabaría en «no se pudo guardar» después de confirmar.
 * Ante cualquier otra duda devuelve true y el guardado da el error.
 */
async function ajustesInstalados(): Promise<boolean> {
  if (!adminEnvReady) return true;
  try {
    // Sin `head: true`: una petición HEAD llega sin cuerpo y el código de
    // «tabla ausente» se pierde por el camino.
    const { error } = await createAdminClient().from("kora_ajustes").select("clave").eq("clave", "saldo_fases").limit(1);
    return !esTablaAusente(error);
  } catch {
    return true;
  }
}

/** Todo lo que pinta /crm/prepago. NUNCA lanza. */
export async function cargarPrepago(): Promise<PanoramaPrepago> {
  // Sin caché: la pantalla del fundador tiene que enseñar lo que está guardado
  // AHORA, no lo que esta instancia recordaba de hace un minuto. Olvidarla aquí
  // sólo cuesta una lectura de más en la siguiente pregunta de Camila.
  invalidarCacheFases();
  const [fases, hoteles, saldos, fasesGuardables] = await Promise.all([
    fasesSaldo(),
    leerHoteles(),
    saldosPorHotel(),
    ajustesInstalados(),
  ]);

  const fallos: string[] = [];
  const pendientes: string[] = [];

  if (!fasesGuardables) {
    pendientes.push(
      "Falta correr sql/kora-crm-mando.sql: hasta entonces los interruptores no se pueden mover desde aquí y mandan SALDO_RECARGA / SALDO_BLOQUEO de Vercel.",
    );
  }
  if (!hoteles.ok) fallos.push("No se pudo leer la lista de hoteles.");

  const faltaSqlSaldo = saldos.error === "falta-sql";
  // `consumo-incompleto` = las filas se leyeron bien y sólo faltan conteos.
  const filasLeidas = saldos.ok || (saldos.error ?? "").startsWith("consumo-incompleto");
  if (faltaSqlSaldo) {
    pendientes.push("Falta correr sql/kora-saldo-bot.sql: todavía no hay prepago que operar.");
  } else if (!filasLeidas) {
    fallos.push("No se pudo leer el saldo de los hoteles.");
  } else if (!saldos.ok) {
    fallos.push("No se pudo contar el consumo de algunos hoteles: les puede faltar el dato de días.");
  }

  const conFila = filasLeidas ? [...saldos.data.keys()] : [];
  const refs = filasLeidas ? await hotelesConRef(conFila, refDeRegalo(ETIQUETA_SEGURIDAD)) : null;
  if (refs && !refs.ok) fallos.push("No se pudo comprobar quién tiene ya la recarga de seguridad.");

  const seguridad: SeguridadPrepago =
    filasLeidas && refs?.ok
      ? seguridadDelPrepago(conFila, refs.ids)
      : { leida: false, total: conFila.length, faltan: [] };

  const filas: HotelPrepago[] = hoteles.data.map((h) => {
    const s = filasLeidas ? saldos.data.get(h.id) : undefined;
    const consumo = s?.consumo30d ?? null;
    return {
      id: h.id,
      slug: h.slug,
      nombre: h.nombre,
      mensajes: s ? s.mensajes : null,
      consumo30d: consumo,
      dias: s && consumo !== null ? diasQueAlcanzan(s.mensajes, consumo / 30) : null,
      seguridad: s ? (refs?.ok ? refs.ids.has(h.id) : null) : null,
    };
  });

  // Primero quien se queda sin saldo antes; al final los que están fuera del
  // prepago, que no corren ningún riesgo.
  filas.sort((a, b) => {
    if (a.mensajes === null || b.mensajes === null) {
      if (a.mensajes === b.mensajes) return a.nombre.localeCompare(b.nombre, "es");
      return a.mensajes === null ? 1 : -1;
    }
    return a.mensajes - b.mensajes || a.nombre.localeCompare(b.nombre, "es");
  });

  return {
    fases,
    saldoInstalado: !faltaSqlSaldo,
    // Lo que se pudo leer de verdad. Sin esto, la pantalla no puede distinguir
    // «este hotel nunca entró al prepago» de «no pude leer el saldo de nadie»,
    // y las dos se pintan igual: con la fila en `mensajes: null`.
    hotelesLeidos: hoteles.ok,
    saldosLeidos: filasLeidas,
    fasesGuardables,
    hoteles: filas,
    enPrepago: filasLeidas ? saldos.data.size : null,
    mudosHoy: filasLeidas ? mudosSiSeEnciende(saldos.data.values()) : null,
    seguridad,
    fallos,
    pendientes,
  };
}

export interface ResultadoRegaloTodos {
  aplicados: { hotel: HotelBasico; nuevo: number }[];
  /** El `ref` ya estaba (otro clic, otra pestaña o el script se adelantaron): no se sumó. */
  repetidos: HotelBasico[];
  fallidos: HotelBasico[];
  /** La función `saldo_acreditar` no existe: falta el SQL del prepago. */
  faltaSql: boolean;
}

/** Cuántos regalos van a la vez: suficiente para decenas de hoteles sin ahogar la base. */
const REGALOS_A_LA_VEZ = 5;

/**
 * Acredita `mensajes` a cada hotel con `ref` (idempotente por hotel). NUNCA
 * lanza: `acreditarMensajes` sí lanza, y aquí cada fallo se queda en su hotel
 * para que uno roto no deje a los demás sin saber si recibieron o no.
 */
export async function aplicarRegaloATodos(
  hoteles: readonly HotelBasico[],
  mensajes: number,
  ref: string,
): Promise<ResultadoRegaloTodos> {
  const r: ResultadoRegaloTodos = { aplicados: [], repetidos: [], fallidos: [], faltaSql: false };
  for (let i = 0; i < hoteles.length; i += REGALOS_A_LA_VEZ) {
    await Promise.all(
      hoteles.slice(i, i + REGALOS_A_LA_VEZ).map(async (hotel) => {
        try {
          // Tipo `regalo`, igual que scripts/regalar-saldo.mjs y la ficha del
          // hotel: los tres se leen igual en `saldo_movimientos`.
          const nuevo = await acreditarMensajes(hotel.id, mensajes, ref, "regalo");
          if (nuevo === SIN_DATO) r.repetidos.push(hotel);
          else r.aplicados.push({ hotel, nuevo });
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          if (/does not exist|Could not find the function|PGRST202|42883/i.test(m)) r.faltaSql = true;
          console.error(`[saldo/prepago-crm] no se pudo regalar a ${hotel.slug}:`, m);
          r.fallidos.push(hotel);
        }
      }),
    );
  }
  return r;
}
