// El ANCLA de la prueba gratis: cuándo empezó, por DUEÑO — y cuántos días extra
// le regaló Kora.
//
// La prueba se derivaba de `hoteles.created_at`. Como el panel deja borrar un
// hotel y volver a crearlo, eso era una prueba INFINITA: borras, recreas, y
// vuelves a tener la prueba entera, indefinidamente y sin tocar nada raro
// (K-108, K-258, K-315). El ancla no puede vivir en algo que el propio usuario
// puede destruir, así que vive en una tabla aparte que sólo se escribe la
// PRIMERA vez y nunca se borra.
//
// Compatible hacia atrás a propósito: mientras `pruebas` no exista o no tenga
// fila para un dueño, todo cae al `created_at` de siempre. Nadie amanece
// pausado por un cambio de reglas retroactivo — y hasta que se corra
// `sql/kora-prueba-por-dueno.sql`, el agujero sigue abierto (no se disimula).
//
// Los DÍAS EXTRA (15 sep 2026). «Dame una semana más» no tenía cómo concederse
// sin SQL. Mover `inicio` habría sido tocar el ancla (y moverlo hacia atrás
// vence la prueba de golpe), así que van en su propia columna, `dias_extra`, y
// se SUMAN al final. Esa columna la crea `sql/kora-crm-mando.sql`; mientras no
// exista, se lee sólo `inicio` y los días extra valen 0.
//
// SOLO servidor: usa la service-role key.
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";

/** Códigos de PostgREST/Postgres para "esa tabla o columna no existe aquí". */
const NO_EXISTE = new Set(["42P01", "42703", "PGRST205", "PGRST204"]);

/** Sólo «esa COLUMNA no existe» (la tabla sí). */
const SIN_COLUMNA = new Set(["42703", "PGRST204"]);

/** El mismo tope que el CHECK de la base: una red contra un dedo de más. */
export const DIAS_EXTRA_MAX = 365;

// Una función serverless vive segundos, pero `accesoDelHotel` corre en CADA
// carga de CADA sitio de hotel. Sin esto, con la tabla sin crear, el log se
// llenaría de la misma línea miles de veces al día.
let yaAvisadoSinTabla = false;

// Si `dias_extra` no existe, cada lectura costaría DOS consultas (la que falla y
// la de respaldo). Se recuerda en esta instancia para ir directo a la segunda —
// pero sólo 5 minutos: una instancia caliente de Vercel puede vivir horas, y sin
// caducidad seguiría ignorando los días extra mucho después de que Manolo
// corriera el SQL y regalara la primera semana.
const RECORDAR_SIN_COLUMNA_MS = 5 * 60_000;
let sinColumnaHasta = 0;
const sinColumnaDiasExtra = () => Date.now() < sinColumnaHasta;
const marcarSinColumna = () => { sinColumnaHasta = Date.now() + RECORDAR_SIN_COLUMNA_MS; };

function esTablaAusente(error: { code?: string } | null): boolean {
  return Boolean(error?.code && NO_EXISTE.has(error.code));
}

function esColumnaAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && SIN_COLUMNA.has(error.code)) return true;
  return /dias_extra/.test(error.message ?? "") && /does not exist|Could not find/i.test(error.message ?? "");
}

function avisarSinTabla(): void {
  if (yaAvisadoSinTabla) return;
  yaAvisadoSinTabla = true;
  console.warn(
    "[pruebas] la tabla no existe todavía: la prueba sigue anclada al created_at " +
      "del hotel, así que borrar y recrear un hotel REINICIA la prueba. " +
      "Corre sql/kora-prueba-por-dueno.sql para cerrarlo.",
  );
}

/** Lo que venga de la base, convertido en un número de días que se puede sumar. */
function diasExtraSanos(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(DIAS_EXTRA_MAX, Math.floor(n));
}

/**
 * Cuándo empezó la prueba de este dueño (ISO) y cuántos días extra tiene.
 * `inicio: null` = no hay dato, o sea «usa el `created_at` del hotel, como
 * siempre».
 *
 * NUNCA lanza: este dato AFINA el cálculo de la prueba, no lo decide. Fallar
 * aquí no puede tumbar el sitio público de un hotel.
 */
export async function anclaPruebaDelDueno(
  userId: string,
): Promise<{ inicio: string | null; diasExtra: number }> {
  const vacio = { inicio: null, diasExtra: 0 };
  if (!adminEnvReady || !userId) return vacio;
  try {
    const admin = createAdminClient();

    if (!sinColumnaDiasExtra()) {
      const { data, error } = await admin
        .from("pruebas")
        .select("inicio, dias_extra")
        .eq("user_id", userId)
        .maybeSingle();
      if (!error) {
        const fila = data as { inicio?: string | null; dias_extra?: unknown } | null;
        return { inicio: fila?.inicio ?? null, diasExtra: diasExtraSanos(fila?.dias_extra) };
      }
      if (esColumnaAusente(error)) {
        // La tabla existe pero falta sql/kora-crm-mando.sql: se sigue sin extras.
        marcarSinColumna();
      } else if (esTablaAusente(error)) {
        avisarSinTabla();
        return vacio;
      } else {
        console.error(`[pruebas] no se pudo leer el ancla de ${userId}:`, error.message);
        return vacio;
      }
    }

    const { data, error } = await admin
      .from("pruebas")
      .select("inicio")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      if (esTablaAusente(error)) avisarSinTabla();
      else console.error(`[pruebas] no se pudo leer el inicio de ${userId}:`, error.message);
      return vacio;
    }
    return { inicio: (data as { inicio: string } | null)?.inicio ?? null, diasExtra: 0 };
  } catch (e) {
    console.error("[pruebas] error leyendo el ancla de la prueba:", e);
    return vacio;
  }
}

/**
 * Cuándo empezó la prueba de este dueño (ISO), o `null` si no hay dato.
 * Se conserva por compatibilidad: lo nuevo debe usar `anclaPruebaDelDueno`,
 * que trae también los días extra.
 */
export async function inicioPruebaDelDueno(userId: string): Promise<string | null> {
  return (await anclaPruebaDelDueno(userId)).inicio;
}

/**
 * Las anclas de varios dueños de una sola consulta (para el cron y el CRM).
 * Sólo trae a quien tiene fila; el resto se calcula con su `created_at`.
 * NUNCA lanza.
 */
export async function anclasPruebaDeDuenos(
  userIds: string[],
): Promise<Map<string, { inicio: string; diasExtra: number }>> {
  const mapa = new Map<string, { inicio: string; diasExtra: number }>();
  const ids = [...new Set((userIds ?? []).filter(Boolean))];
  if (!adminEnvReady || ids.length === 0) return mapa;
  try {
    const admin = createAdminClient();

    if (!sinColumnaDiasExtra()) {
      const { data, error } = await admin
        .from("pruebas")
        .select("user_id, inicio, dias_extra")
        .in("user_id", ids);
      if (!error) {
        for (const f of (data ?? []) as Array<{ user_id: string; inicio: string; dias_extra?: unknown }>) {
          if (f?.user_id && f?.inicio) {
            mapa.set(f.user_id, { inicio: f.inicio, diasExtra: diasExtraSanos(f.dias_extra) });
          }
        }
        return mapa;
      }
      if (esColumnaAusente(error)) {
        marcarSinColumna();
      } else {
        if (!esTablaAusente(error)) {
          console.error("[pruebas] no se pudieron leer las anclas:", error.message);
        }
        return mapa;
      }
    }

    const { data, error } = await admin.from("pruebas").select("user_id, inicio").in("user_id", ids);
    if (error) {
      if (!esTablaAusente(error)) {
        console.error("[pruebas] no se pudieron leer los inicios:", error.message);
      }
      return mapa;
    }
    for (const f of (data ?? []) as Array<{ user_id: string; inicio: string }>) {
      if (f?.user_id && f?.inicio) mapa.set(f.user_id, { inicio: f.inicio, diasExtra: 0 });
    }
  } catch (e) {
    console.error("[pruebas] error leyendo las anclas:", e);
  }
  return mapa;
}

/**
 * Los inicios de varios dueños de una sola consulta. Se conserva por
 * compatibilidad: lo nuevo debe usar `anclasPruebaDeDuenos`.
 */
export async function iniciosPruebaDeDuenos(userIds: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  for (const [id, a] of await anclasPruebaDeDuenos(userIds)) mapa.set(id, a.inicio);
  return mapa;
}

/**
 * Deja anclada la prueba de este dueño si aún no lo estaba. Se llama al crear un
 * hotel. `ignoreDuplicates` es lo que hace que sea "la primera vez y ya": un
 * segundo hotel —o volver a crear el que borró— no mueve la fecha.
 *
 * NUNCA lanza: si esto falla, el alta del hotel debe seguir adelante. Lo peor que
 * pasa es que ese dueño conserve el comportamiento viejo.
 */
export async function sembrarInicioPrueba(userId: string, inicioISO: string): Promise<void> {
  if (!adminEnvReady || !userId) return;
  try {
    const { error } = await createAdminClient()
      .from("pruebas")
      .upsert({ user_id: userId, inicio: inicioISO }, { onConflict: "user_id", ignoreDuplicates: true });
    if (error && !esTablaAusente(error)) {
      console.error(`[pruebas] no se pudo anclar la prueba de ${userId}:`, error.message);
    }
  } catch (e) {
    console.error("[pruebas] error anclando la prueba:", e);
  }
}

/**
 * Fija los días extra de prueba de un dueño (para el CRM). NUNCA lanza.
 *
 * FIJA, no suma, aunque se llame así por lo que hace el botón: quien llama
 * calcula el total (lo que tenía + lo que regala) y lo pasa entero. Así un doble
 * clic o un reintento tras un corte de red escriben «14» dos veces en vez de
 * regalar 28. Para quitar los extras, se pasa 0.
 *
 * Si el dueño no tiene fila en `pruebas` (anterior al ancla, o el SQL del ancla
 * se corrió tarde), se crea con `inicio = inicioSiNoHay`. Quien llama debe pasar
 * el `created_at` de su hotel MÁS ANTIGUO: es exactamente la fecha con la que ya
 * se le calculaba la prueba, así que crear la fila no le mueve ni un día.
 *
 * Nunca toca `inicio` de una fila que ya existe: el ancla es sagrada.
 *
 * Errores: 'datos-invalidos' | 'sin-base' | 'falta-sql' (con `faltaSql: true`) |
 * 'usuario-no-existe' | 'no-guardado'.
 */
export async function sumarDiasExtraPrueba(
  userId: string,
  diasExtraNuevo: number,
  inicioSiNoHay: string,
): Promise<{ ok: boolean; error?: string; faltaSql?: boolean }> {
  if (
    typeof userId !== "string" ||
    !userId ||
    typeof diasExtraNuevo !== "number" ||
    !Number.isInteger(diasExtraNuevo) ||
    diasExtraNuevo < 0 ||
    diasExtraNuevo > DIAS_EXTRA_MAX ||
    typeof inicioSiNoHay !== "string" ||
    Number.isNaN(Date.parse(inicioSiNoHay))
  ) {
    return { ok: false, error: "datos-invalidos" };
  }
  if (!adminEnvReady) return { ok: false, error: "sin-base" };

  const traducir = (error: { code?: string; message?: string }) => {
    if (esColumnaAusente(error) || esTablaAusente(error)) {
      return { ok: false, error: "falta-sql", faltaSql: true };
    }
    if (error.code === "23503") return { ok: false, error: "usuario-no-existe" };
    if (error.code === "23514") return { ok: false, error: "datos-invalidos" };
    console.error(`[pruebas] no se pudieron fijar los días extra de ${userId}:`, error.message);
    return { ok: false, error: "no-guardado" };
  };

  try {
    const admin = createAdminClient();

    // Dos intentos: si entre el UPDATE (0 filas) y el INSERT otra petición crea
    // la fila —el alta de un hotel siembra el ancla—, el INSERT choca con la
    // llave y la segunda vuelta la actualiza.
    for (let intento = 0; intento < 2; intento++) {
      const { data, error } = await admin
        .from("pruebas")
        .update({ dias_extra: diasExtraNuevo })
        .eq("user_id", userId)
        .select("user_id");
      if (error) return traducir(error);
      if ((data ?? []).length > 0) {
        sinColumnaHasta = 0;
        return { ok: true };
      }

      const { error: errorAlta } = await admin
        .from("pruebas")
        .insert({ user_id: userId, inicio: inicioSiNoHay, dias_extra: diasExtraNuevo });
      if (!errorAlta) {
        sinColumnaHasta = 0;
        return { ok: true };
      }
      if (errorAlta.code !== "23505") return traducir(errorAlta);
    }
    return { ok: false, error: "no-guardado" };
  } catch (e) {
    console.error("[pruebas] error fijando los días extra:", e);
    return { ok: false, error: "no-guardado" };
  }
}
