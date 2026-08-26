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
//
// El respaldo de transición que leía y escribía en `config` se borró el 25 de
// agosto de 2026, una vez corridos los tres SQL (`kora-bot-tokens-paso1/2/3`):
// `config.agent_token` ya no existe en la base, así que leerlo sólo podía
// devolver un token muerto y disimular que la tabla nueva se había caído.
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { leer, escribir } from "@/lib/db/result";

/** Genera un token nuevo con el formato de siempre. */
export function nuevoBotToken(): string {
  return `kora_${randomUUID().replace(/-/g, "")}`;
}

/** El token de un hotel, o null si no tiene. LANZA si la consulta falla. */
export async function getBotToken(hotelId: string): Promise<string | null> {
  const fila = await leer<{ token: string }>(
    "bot_token.porHotel",
    createAdminClient().from("hotel_bot_tokens").select("token").eq("hotel_id", hotelId).maybeSingle(),
  );
  return fila?.token ?? null;
}

/** Guarda (o reemplaza) el token de un hotel. LANZA si la escritura falla. */
export async function setBotToken(hotelId: string, token: string): Promise<void> {
  await escribir(
    "bot_token.guardar",
    createAdminClient()
      .from("hotel_bot_tokens")
      .upsert({ hotel_id: hotelId, token, updated_at: new Date().toISOString() }, { onConflict: "hotel_id" }),
  );
}

/**
 * El token del hotel; si no tiene, se le genera y guarda uno.
 * LANZA si no se pudo persistir: sin token guardado el bot no puede hablar con
 * /api/agent, y devolver uno que no está en la base sería peor que fallar.
 */
export async function asegurarBotToken(hotelId: string): Promise<string> {
  const actual = await getBotToken(hotelId);
  if (actual) return actual;
  const token = nuevoBotToken();
  await setBotToken(hotelId, token);
  return token;
}

/**
 * Hotel al que pertenece un token, o null si el token no existe. LANZA si la
 * consulta falla.
 *
 * La diferencia es la que apagaba a Camila sola: un error de base de datos se le
 * reportaba al runtime como "token inválido", y el runtime concluía que lo habían
 * desautorizado y se detenía. Ahora eso es un 503 y el bot reintenta.
 */
export async function hotelIdPorBotToken(token: string): Promise<string | null> {
  if (!token) return null;
  const fila = await leer<{ hotel_id: string }>(
    "bot_token.aHotel",
    createAdminClient().from("hotel_bot_tokens").select("hotel_id").eq("token", token).maybeSingle(),
  );
  return fila?.hotel_id ?? null;
}
