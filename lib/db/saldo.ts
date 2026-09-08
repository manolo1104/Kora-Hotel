// El saldo prepago del bot de WhatsApp, visto desde el servidor.
//
// Toda la aritmética vive en Postgres (`sql/kora-saldo-bot.sql`): aquí sólo se
// llaman las tres funciones y se decide qué hacer cuando fallan. Esa decisión es
// la parte importante de este archivo, así que va escrita arriba:
//
// ── LA DIRECCIÓN DEL FALLO ES SIEMPRE «QUE SIGA HABLANDO» ────────────────────
//
// Si no se puede leer el saldo —red, base caída, SQL sin correr— el bot NO se
// calla. Regalar unos mensajes cuesta céntimos; dejar mudo el WhatsApp de un
// hotel que paga $550/mes cuesta el cliente. Es la misma doctrina de
// `pausaDeChat` y `kora.status()`.
//
// Y si no se puede COBRAR, el mensaje sale gratis. Cobrar por un mensaje que
// quizá no salió es peor que no cobrarlo.

import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { UMBRAL_AVISO_BAJO } from "@/lib/saldo/paquetes";

/** Cuando el saldo no se puede leer o el hotel no tiene fila. */
export const SIN_DATO = -1;

/**
 * Códigos que significan «el SQL todavía no está corrido», no «hubo un error».
 *
 * Mismo criterio que `lib/db/availability.ts` con `apartar_unidades_atomico` y
 * que `lib/api/rate-limit.ts` con `rl_consumir`: mientras el SQL no exista, todo
 * funciona como antes y no se ensucia el log con un error por cada mensaje.
 */
const SQL_SIN_CORRER = new Set(["42883", "42P01", "PGRST202", "PGRST205"]);

function faltaElSql(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && SQL_SIN_CORRER.has(error.code)) return true;
  return /does not exist|Could not find the (function|table)/i.test(error.message ?? "");
}

export interface SaldoHotel {
  /** Mensajes que quedan. `SIN_DATO` = no se pudo leer, o el hotel no tiene fila. */
  mensajes: number;
  /** `false` cuando no se pudo leer: quien decide bloquear DEBE mirar esto. */
  conocido: boolean;
}

/**
 * Cuántos mensajes le quedan a un hotel.
 *
 * Un hotel SIN fila devuelve `conocido: true` y `mensajes: SIN_DATO`. Eso NO es
 * «sin saldo»: es «no está dado de alta en el prepago», y `sinSaldo()` lo trata
 * como que puede seguir contestando. Un regalo que no se aplicó no puede dejar
 * mudo a un hotel.
 */
export async function leerSaldo(hotelId: string): Promise<SaldoHotel> {
  if (!adminEnvReady || !hotelId) return { mensajes: SIN_DATO, conocido: false };
  try {
    const { data, error } = await createAdminClient()
      .from("saldo_bot")
      .select("mensajes")
      .eq("hotel_id", hotelId)
      .maybeSingle();
    if (error) {
      if (!faltaElSql(error)) console.error("[saldo] no se pudo leer:", error.message);
      return { mensajes: SIN_DATO, conocido: false };
    }
    const n = (data as { mensajes?: number } | null)?.mensajes;
    return { mensajes: typeof n === "number" ? n : SIN_DATO, conocido: true };
  } catch (e) {
    console.error("[saldo] no se pudo leer:", e);
    return { mensajes: SIN_DATO, conocido: false };
  }
}

/**
 * ¿Hay que callar a Camila por falta de saldo?
 *
 * Sólo cuando se leyó bien Y el hotel tiene fila Y está en cero. Cualquier otra
 * combinación —incluida «no pude leer»— deja al bot hablando.
 */
export function sinSaldo(s: SaldoHotel): boolean {
  return s.conocido && s.mensajes !== SIN_DATO && s.mensajes <= 0;
}

/**
 * Descuenta un mensaje. Devuelve el saldo que queda, o `SIN_DATO`.
 *
 * `ref` es el id del mensaje de WhatsApp: repetirlo NO vuelve a cobrar. Si viene
 * vacío se cobra igual, sin red de dedupe — perder un cobro es peor que no tener
 * el identificador.
 */
export async function consumirMensaje(hotelId: string, ref = ""): Promise<number> {
  if (!adminEnvReady || !hotelId) return SIN_DATO;
  try {
    const { data, error } = await createAdminClient().rpc("saldo_consumir", {
      p_hotel_id: hotelId,
      p_ref: (ref ?? "").slice(0, 200),
    });
    if (error) {
      if (!faltaElSql(error)) console.error("[saldo] no se pudo cobrar el mensaje:", error.message);
      return SIN_DATO;
    }
    return typeof data === "number" ? data : SIN_DATO;
  } catch (e) {
    console.error("[saldo] no se pudo cobrar el mensaje:", e);
    return SIN_DATO;
  }
}

export type TipoAbono = "recarga" | "regalo" | "ajuste";

/**
 * Acredita mensajes. Devuelve el saldo nuevo, `SIN_DATO` si el `ref` ya se había
 * aplicado (repetición: NO acreditó), o lanza si algo falló de verdad.
 *
 * **Esta sí lanza**, al revés que el resto del archivo. Es la doctrina de
 * `lib/db/result.ts`: perder una recarga que el hotelero ya pagó es el fallo más
 * caro que hay aquí. Quien la llama (el webhook de Stripe) devuelve 500 y Stripe
 * reintenta; el `ref` garantiza que el reintento no acredite dos veces.
 */
export async function acreditarMensajes(
  hotelId: string,
  mensajes: number,
  ref: string,
  tipo: TipoAbono = "recarga",
): Promise<number> {
  if (!adminEnvReady) throw new Error("saldo: falta la service-role de Supabase");
  const { data, error } = await createAdminClient().rpc("saldo_acreditar", {
    p_hotel_id: hotelId,
    p_mensajes: mensajes,
    p_ref: (ref ?? "").slice(0, 200),
    p_tipo: tipo,
  });
  if (error) throw new Error(`saldo_acreditar: ${error.message}`);
  return typeof data === "number" ? data : SIN_DATO;
}

/**
 * ¿Me toca a mí mandar el correo de aviso?
 *
 * Devuelve `true` UNA sola vez. Reclama la fila ANTES de enviar, igual que el
 * cron de dunning: sin esto, tres mensajes simultáneos del mismo hotel cruzarían
 * el umbral a la vez y el hotelero recibiría tres correos idénticos.
 *
 * Ante un fallo devuelve `false` — no mandar un aviso es más barato que mandar
 * cinco.
 */
export async function reclamarAviso(hotelId: string, cual: "bajo" | "cero"): Promise<boolean> {
  if (!adminEnvReady || !hotelId) return false;
  try {
    const { data, error } = await createAdminClient().rpc("saldo_reclamar_aviso", {
      p_hotel_id: hotelId,
      p_cual: cual,
      p_umbral: cual === "bajo" ? UMBRAL_AVISO_BAJO : 0,
    });
    if (error) {
      if (!faltaElSql(error)) console.error("[saldo] no se pudo reclamar el aviso:", error.message);
      return false;
    }
    return data === true;
  } catch (e) {
    console.error("[saldo] no se pudo reclamar el aviso:", e);
    return false;
  }
}

export interface ConsumoReciente {
  /** Mensajes gastados en los últimos 30 días. */
  mensajes: number;
  /** Media por día, para estimar cuánto le dura el saldo. */
  porDia: number;
}

/** En qué se le fue el saldo, para la pantalla de Camila. */
export async function consumoDelMes(hotelId: string, dias = 30): Promise<ConsumoReciente> {
  const vacio = { mensajes: 0, porDia: 0 };
  if (!adminEnvReady || !hotelId) return vacio;
  try {
    const desde = new Date(Date.now() - dias * 86_400_000).toISOString();
    const { count, error } = await createAdminClient()
      .from("saldo_movimientos")
      .select("id", { count: "exact", head: true })
      .eq("hotel_id", hotelId)
      .eq("tipo", "consumo")
      .gte("created_at", desde);
    if (error) {
      if (!faltaElSql(error)) console.error("[saldo] no se pudo leer el consumo:", error.message);
      return vacio;
    }
    const n = count ?? 0;
    return { mensajes: n, porDia: n / dias };
  } catch (e) {
    console.error("[saldo] no se pudo leer el consumo:", e);
    return vacio;
  }
}
