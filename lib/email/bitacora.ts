// La bitácora de correos que NO salieron, y su reintento.
//
// `enviarEmail` nunca lanza a propósito: una reserva no se puede caer porque el
// correo falle. Pero hasta el 31 ago 2026 el fallo moría en un `console.error`
// que nadie lee, así que el huésped se quedaba sin su confirmación y nadie se
// enteraba hasta que reclamaba por WhatsApp tres días después.
//
// Se apoya en `email_log`, que ya existía con la clave única correcta y que ya
// usan las secuencias de estancia para deduplicar: así el registro de fallos y
// el de envíos viven en la misma tabla y el reintento es una consulta.
// Columnas nuevas en sql/kora-email-estado.sql.
//
// ALCANCE, dicho claro: sólo cubre correos que tengan hotel y folio —los del
// motor de reservas—, porque `email_log.hotel_id` es NOT NULL con clave foránea.
// Los de Kora al hotelero (dunning, prueba, digest) no caben aquí; su red es
// `alertar()`. Y el reintento sólo sabe RECONSTRUIR la confirmación de reserva,
// porque el HTML no se guarda: se vuelve a armar desde la reserva, igual que
// hace el botón de reenviar del portal.

import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import type { ResultadoEmail } from "@/lib/email/resend";

/** Tipos que esta bitácora registra. Los de las secuencias tienen los suyos. */
export type TipoCorreo = "confirmacion_reserva";

/** Después de este número de intentos se deja de reintentar y se dice. */
export const MAX_INTENTOS = 3;

export interface FilaFallida {
  id: string;
  hotel_id: string;
  confirmacion: string | null;
  email_type: string;
  email_destino: string | null;
  intentos: number;
  ultimo_error: string | null;
}

/**
 * Deja constancia de un envío. `mejor esfuerzo`: si la tabla todavía no tiene
 * las columnas nuevas —el SQL sin correr— no rompe el flujo que la llamó, que
 * es justo lo que esta función existe para proteger.
 */
export async function registrarCorreo(args: {
  hotelId: string;
  confirmacion: string;
  tipo: TipoCorreo;
  destino: string;
  resultado: ResultadoEmail;
}): Promise<void> {
  if (!adminEnvReady) return;
  const ok = args.resultado.ok;
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("email_log").upsert(
      {
        hotel_id: args.hotelId,
        confirmacion: args.confirmacion,
        email_type: args.tipo,
        email_destino: args.destino,
        resend_id: ok ? args.resultado.id : null,
        estado: ok ? "enviado" : "fallido",
        ultimo_error: ok ? null : args.resultado.error,
        ultimo_intento_at: new Date().toISOString(),
      },
      { onConflict: "hotel_id,confirmacion,email_type" },
    );
    // Apunte AUXILIAR: es la bitácora de lo que se mandó. Lanzar aquí haría
    // fallar el ENVÍO por no haber podido apuntarlo, que es exactamente al revés
    // de para lo que sirve. Se registra y se sigue.
    if (error) console.error("[bitacora] no se pudo registrar el correo:", error.message);
  } catch (e) {
    console.error("[bitacora] error registrando:", e);
  }
}

/** Los correos fallidos a los que todavía les quedan intentos. */
export async function correosFallidos(): Promise<FilaFallida[]> {
  if (!adminEnvReady) return [];
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("email_log")
      .select("id, hotel_id, confirmacion, email_type, email_destino, intentos, ultimo_error")
      .eq("estado", "fallido")
      .lt("intentos", MAX_INTENTOS)
      // Sin `resend_id` NO llegó a Resend. Con él, el fallo fue del lado de acá
      // (un timeout leyendo la respuesta) y el correo pudo haber salido: se deja
      // fuera del reintento para no mandarle dos confirmaciones al mismo huésped.
      .is("resend_id", null)
      .limit(50);
    if (error) {
      // La columna `estado` no existe todavía: el SQL está sin correr. Se dice y
      // se sigue, en vez de tumbar el digest entero.
      console.error("[bitacora] no se pudieron leer los fallidos:", error.message);
      return [];
    }
    return (data ?? []) as FilaFallida[];
  } catch (e) {
    console.error("[bitacora] error leyendo fallidos:", e);
    return [];
  }
}

/** Anota el resultado de un reintento sobre una fila que ya existía. */
export async function anotarReintento(fila: FilaFallida, resultado: ResultadoEmail): Promise<void> {
  if (!adminEnvReady) return;
  const intentos = fila.intentos + 1;
  try {
    const admin = createAdminClient();
    await admin
      .from("email_log")
      .update({
        estado: resultado.ok ? "enviado" : intentos >= MAX_INTENTOS ? "agotado" : "fallido",
        intentos,
        resend_id: resultado.ok ? resultado.id : null,
        ultimo_error: resultado.ok ? null : resultado.error,
        ultimo_intento_at: new Date().toISOString(),
      })
      .eq("id", fila.id);
  } catch (e) {
    console.error("[bitacora] error anotando reintento:", e);
  }
}
