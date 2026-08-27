// El ANCLA de la prueba de 30 días: cuándo empezó, por DUEÑO.
//
// La prueba se derivaba de `hoteles.created_at`. Como el panel deja borrar un
// hotel y volver a crearlo, eso era una prueba INFINITA: borras, recreas, y
// vuelves a tener 30 días gratis, indefinidamente y sin tocar nada raro
// (K-108, K-258, K-315). El ancla no puede vivir en algo que el propio usuario
// puede destruir, así que vive en una tabla aparte que sólo se escribe la
// PRIMERA vez y nunca se borra.
//
// Compatible hacia atrás a propósito: mientras `pruebas` no exista o no tenga
// fila para un dueño, todo cae al `created_at` de siempre. Nadie amanece
// pausado por un cambio de reglas retroactivo — y hasta que se corra
// `sql/kora-prueba-por-dueno.sql`, el agujero sigue abierto (no se disimula).
//
// SOLO servidor: usa la service-role key.
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";

/** Códigos de PostgREST/Postgres para "esa tabla o columna no existe aquí". */
const NO_EXISTE = new Set(["42P01", "42703", "PGRST205", "PGRST204"]);

// Una función serverless vive segundos, pero `accesoDelHotel` corre en CADA
// carga de CADA sitio de hotel. Sin esto, con la tabla sin crear, el log se
// llenaría de la misma línea miles de veces al día.
let yaAvisadoSinTabla = false;

function esTablaAusente(error: { code?: string } | null): boolean {
  return Boolean(error?.code && NO_EXISTE.has(error.code));
}

/**
 * Cuándo empezó la prueba de este dueño (ISO), o `null` si no hay dato — que es
 * lo mismo que decir "usa el `created_at` del hotel, como siempre".
 *
 * NUNCA lanza: este dato AFINA el cálculo de la prueba, no lo decide. Fallar
 * aquí no puede tumbar el sitio público de un hotel.
 */
export async function inicioPruebaDelDueno(userId: string): Promise<string | null> {
  if (!adminEnvReady || !userId) return null;
  try {
    const { data, error } = await createAdminClient()
      .from("pruebas")
      .select("inicio")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      if (esTablaAusente(error)) {
        if (!yaAvisadoSinTabla) {
          yaAvisadoSinTabla = true;
          console.warn(
            "[pruebas] la tabla no existe todavía: la prueba sigue anclada al created_at " +
              "del hotel, así que borrar y recrear un hotel REINICIA los 30 días. " +
              "Corre sql/kora-prueba-por-dueno.sql para cerrarlo.",
          );
        }
        return null;
      }
      console.error(`[pruebas] no se pudo leer el inicio de ${userId}:`, error.message);
      return null;
    }
    return (data as { inicio: string } | null)?.inicio ?? null;
  } catch (e) {
    console.error("[pruebas] error leyendo el inicio de la prueba:", e);
    return null;
  }
}

/** Los inicios de varios dueños de una sola consulta (para el cron). */
export async function iniciosPruebaDeDuenos(userIds: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (!adminEnvReady || ids.length === 0) return mapa;
  try {
    const { data, error } = await createAdminClient()
      .from("pruebas")
      .select("user_id, inicio")
      .in("user_id", ids);
    if (error) {
      if (!esTablaAusente(error)) {
        console.error("[pruebas] no se pudieron leer los inicios:", error.message);
      }
      return mapa;
    }
    for (const f of (data ?? []) as Array<{ user_id: string; inicio: string }>) {
      if (f?.user_id && f?.inicio) mapa.set(f.user_id, f.inicio);
    }
  } catch (e) {
    console.error("[pruebas] error leyendo los inicios:", e);
  }
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
