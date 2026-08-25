// Token con el que el runtime de Camila se identifica ante /api/agent.
//
// Vivía dentro de `hoteles.config.agent_token`. La única política de lectura de
// `hoteles` es `for select using (true)`, y ese mecanismo no filtra columnas: con
// la llave anónima —que viaja en el JavaScript que descarga cualquier visitante—
// se podía pedir `GET /rest/v1/hoteles?select=slug,config` y recibir el token de
// todos los hoteles. Con él, un anónimo apagaba a Camila de cualquier hotel,
// generaba links de pago a su nombre y le bloqueaba cuartos reales.
//
// Ahora vive en `hotel_bot_tokens`, una tabla con RLS activo y SIN NINGUNA
// política: sólo la service-role (que salta RLS) la ve. Es el mismo patrón que ya
// usan `reviews` y `experiencia_ventas`. Todo lo de este archivo es SOLO servidor.
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/** Genera un token nuevo con el formato de siempre. */
export function nuevoBotToken(): string {
  return `kora_${randomUUID().replace(/-/g, "")}`;
}

/**
 * TRANSICIÓN — bórrese cuando `sql/kora-bot-tokens-paso2.sql` esté corrido.
 *
 * Entre el despliegue de este código y la corrida de `paso1`, la tabla nueva
 * puede no existir todavía. Sin este respaldo, ese hueco tumbaría a Camila en
 * TODOS los hoteles: el fleet no encontraría ningún token y los saltaría a todos.
 * Con él, el orden entre desplegar y correr el SQL deja de importar.
 *
 * No debilita el arreglo: el token de `config` es el que ya es público hoy, y
 * `paso2` lo borra. En cuanto eso pase, este camino no encuentra nada.
 */
function tablaNoExiste(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const c = error.code ?? "";
  return c === "42P01" || c === "PGRST205" || /hotel_bot_tokens.*does not exist/i.test(error.message ?? "");
}

/** El token de un hotel, o null si no tiene (o si no se pudo leer). */
export async function getBotToken(hotelId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("hotel_bot_tokens")
    .select("token")
    .eq("hotel_id", hotelId)
    .maybeSingle();
  if (error) {
    if (tablaNoExiste(error)) {
      console.warn("[bot-token] falta hotel_bot_tokens: corre sql/kora-bot-tokens-paso1.sql");
      const { data: viejo } = await admin
        .from("hoteles")
        .select("config")
        .eq("id", hotelId)
        .maybeSingle();
      const cfg = (viejo?.config ?? {}) as Record<string, unknown>;
      return typeof cfg.agent_token === "string" ? cfg.agent_token : null;
    }
    console.error(`getBotToken(${hotelId}):`, error.message);
    return null;
  }
  return (data?.token as string) ?? null;
}

/** Guarda (o reemplaza) el token de un hotel. Devuelve false si falló. */
export async function setBotToken(hotelId: string, token: string): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("hotel_bot_tokens")
    .upsert({ hotel_id: hotelId, token, updated_at: new Date().toISOString() }, { onConflict: "hotel_id" });
  if (!error) return true;

  if (tablaNoExiste(error)) {
    // Respaldo de transición: se guarda donde se guardaba antes para que un hotel
    // nuevo no se quede sin bot mientras el SQL no esté corrido.
    console.warn("[bot-token] falta hotel_bot_tokens: guardando en config (corre paso1)");
    const { data: fila } = await admin.from("hoteles").select("config").eq("id", hotelId).maybeSingle();
    const cfg = (fila?.config ?? {}) as Record<string, unknown>;
    const { error: e2 } = await admin
      .from("hoteles")
      .update({ config: { ...cfg, agent_token: token } })
      .eq("id", hotelId);
    if (e2) {
      console.error(`setBotToken(${hotelId}) respaldo:`, e2.message);
      return false;
    }
    return true;
  }
  console.error(`setBotToken(${hotelId}):`, error.message);
  return false;
}

/**
 * El token del hotel; si no tiene, se le genera y guarda uno.
 * Devuelve null si la escritura falló — sin token persistido el bot no puede
 * hablar con /api/agent, así que quien llame debe tratarlo como fallo.
 */
export async function asegurarBotToken(hotelId: string): Promise<string | null> {
  const actual = await getBotToken(hotelId);
  if (actual) return actual;
  const token = nuevoBotToken();
  return (await setBotToken(hotelId, token)) ? token : null;
}

/** Hotel al que pertenece un token, o null. Es la autenticación del bot. */
export async function hotelIdPorBotToken(token: string): Promise<string | null> {
  if (!token) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("hotel_bot_tokens")
    .select("hotel_id")
    .eq("token", token)
    .maybeSingle();
  if (error) {
    if (tablaNoExiste(error)) {
      // Transición: mientras no exista la tabla, se autentica como antes.
      const { data: viejo } = await admin
        .from("hoteles")
        .select("id")
        .eq("config->>agent_token", token)
        .maybeSingle();
      return (viejo?.id as string) ?? null;
    }
    console.error("hotelIdPorBotToken:", error.message);
    return null;
  }
  return (data?.hotel_id as string) ?? null;
}
