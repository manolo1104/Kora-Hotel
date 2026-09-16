// La bitácora de lo que hace el fundador desde /crm. SOLO servidor (service-role).
//
// Hasta ahora el único botón del CRM que escribía —bloquear un hotel— dejaba un
// `console.log` y nada más. Con botones que regalan saldo, alargan pruebas y
// callan a Camila, «¿quién hizo esto, cuándo y por qué?» tiene que tener
// respuesta sin abrir los logs de Vercel.
//
// ── LA BITÁCORA NUNCA TUMBA LA ACCIÓN ────────────────────────────────────────
//
// `registrarAccion` no lanza jamás. La acción ya pasó (el saldo ya se acreditó,
// el hotel ya se bloqueó): que falle el apunte no puede convertir en error algo
// que sí se hizo, porque el fundador lo reintentaría y regalaría dos veces. Por
// eso devuelve `false` y quien llama decide si avisarlo en pantalla.
//
// Mientras `sql/kora-crm-mando.sql` no esté corrido, la tabla no existe: se
// avisa UNA vez en el log y se sigue.

import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";

/** Códigos de PostgREST/Postgres para «esa tabla no existe aquí». */
const TABLA_AUSENTE = new Set(["42P01", "PGRST205"]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Una función serverless vive segundos, pero cada botón del CRM pasa por aquí:
// sin esto, con la tabla sin crear, el log repetiría la misma línea en cada clic.
let yaAvisadoSinTabla = false;

function avisarSinTabla(): void {
  if (yaAvisadoSinTabla) return;
  yaAvisadoSinTabla = true;
  console.warn(
    "[bitácora] la tabla crm_bitacora no existe todavía: las acciones del CRM se hacen, " +
      "pero no queda rastro. Corre sql/kora-crm-mando.sql para guardarlas.",
  );
}

function esTablaAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && TABLA_AUSENTE.has(error.code)) return true;
  return /Could not find the table|relation .* does not exist/i.test(error.message ?? "");
}

export type FilaBitacora = {
  id: string;
  created_at: string;
  accion: string;
  hotel_id: string | null;
  hotel_slug: string | null;
  user_id: string | null;
  motivo: string | null;
  antes: unknown;
  despues: unknown;
  detalle: unknown;
};

/** Texto recortado, o null si viene vacío. */
function texto(v: string | null | undefined, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/**
 * Un id que no es uuid haría fallar el INSERT entero (22P02) y se perdería el
 * apunte por un dato secundario. Mejor guardarlo sin el id que no guardarlo.
 */
function uuidONull(v: string | null | undefined): string | null {
  return typeof v === "string" && UUID.test(v) ? v : null;
}

/**
 * A JSON plano. `undefined` → null. Lo que no se pueda serializar (una
 * referencia circular, un BigInt) se sustituye por una nota en vez de romper.
 */
function aJson(v: unknown): unknown {
  if (v === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(v)) ?? null;
  } catch {
    return { nota: "no se pudo guardar este dato" };
  }
}

/**
 * Apunta una acción del fundador. NUNCA lanza.
 *
 * `accion` es una etiqueta corta y estable ('saldo.regalar', 'prueba.dias_extra',
 * 'hotel.bloquear'…): es por lo que se filtra después, así que no lleva texto
 * libre. El porqué va en `motivo`.
 *
 * @returns true si quedó escrita; false si no (tabla ausente, sin base, error).
 */
export async function registrarAccion(e: {
  accion: string;
  hotelId?: string | null;
  hotelSlug?: string | null;
  userId?: string | null;
  motivo?: string | null;
  antes?: unknown;
  despues?: unknown;
  detalle?: unknown;
}): Promise<boolean> {
  try {
    const accion = texto(e?.accion, 100);
    if (!accion) {
      console.error("[bitácora] se intentó registrar una acción sin nombre:", e);
      return false;
    }
    if (!adminEnvReady) return false;

    const { error } = await createAdminClient()
      .from("crm_bitacora")
      .insert({
        accion,
        hotel_id: uuidONull(e.hotelId),
        hotel_slug: texto(e.hotelSlug, 200),
        user_id: uuidONull(e.userId),
        motivo: texto(e.motivo, 2000),
        antes: aJson(e.antes),
        despues: aJson(e.despues),
        detalle: aJson(e.detalle),
      });

    if (error) {
      if (esTablaAusente(error)) avisarSinTabla();
      else console.error(`[bitácora] no se pudo apuntar «${accion}»:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[bitácora] error apuntando una acción:", err);
    return false;
  }
}

/**
 * Las últimas acciones, de todo el negocio o de un hotel. NUNCA lanza.
 *
 * `faltaSql: true` es «la tabla no existe todavía» — no es un fallo y la
 * pantalla lo enseña como nota gris con el archivo que hay que correr, no como
 * banda roja (misma regla que lib/crm/operaciones.ts).
 */
export async function leerBitacora(opts: {
  hotelId?: string;
  limite?: number;
}): Promise<{ ok: boolean; filas: FilaBitacora[]; faltaSql: boolean }> {
  const limite = Math.min(500, Math.max(1, Math.floor(Number(opts?.limite) || 50)));
  if (!adminEnvReady) return { ok: false, filas: [], faltaSql: false };

  // Un id de hotel mal formado haría fallar la consulta con un error de tipo; la
  // respuesta honesta es «ese hotel no tiene apuntes», no «la bitácora falló».
  if (opts?.hotelId !== undefined && !UUID.test(opts.hotelId)) {
    return { ok: true, filas: [], faltaSql: false };
  }

  try {
    let q = createAdminClient()
      .from("crm_bitacora")
      .select("id, created_at, accion, hotel_id, hotel_slug, user_id, motivo, antes, despues, detalle")
      .order("created_at", { ascending: false })
      .limit(limite);
    if (opts?.hotelId) q = q.eq("hotel_id", opts.hotelId);

    const { data, error } = await q;
    if (error) {
      if (esTablaAusente(error)) {
        avisarSinTabla();
        return { ok: false, filas: [], faltaSql: true };
      }
      console.error("[bitácora] no se pudo leer:", error.message);
      return { ok: false, filas: [], faltaSql: false };
    }
    return { ok: true, filas: (data ?? []) as FilaBitacora[], faltaSql: false };
  } catch (err) {
    console.error("[bitácora] error leyendo:", err);
    return { ok: false, filas: [], faltaSql: false };
  }
}
