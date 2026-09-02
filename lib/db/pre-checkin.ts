// El registro que el huésped llena antes de llegar (pre check-in).
//
// POR QUÉ EXISTE: el hotelero que paga pidió que el huésped pudiera registrarse
// desde su celular, "ya que una mala experiencia para el huésped puede ser tener
// que esperar demasiado tiempo en recepción".
//
// QUÉ SE GUARDA Y QUÉ NO: datos de registro y firma. **Nunca la foto de una
// identificación** — decisión explícita, no un pendiente. Se guarda el TIPO de
// documento y sus últimos dígitos, que es lo que recepción coteja, sin
// custodiar imágenes de INE ni pasaportes.
//
// AISLAMIENTO: la tabla es cerrada (RLS sin políticas + revoke; ver
// sql/kora-pre-checkin.sql), así que sólo la service-role entra y el filtro por
// hotel lo hace ESTE archivo. Toda consulta lleva `.eq("hotel_id", hotelId)`.

import { createAdminClient } from "@/lib/supabase/admin";
import { escribir, leer } from "@/lib/db/result";

/** Un acompañante del huésped principal. */
export interface Acompanante {
  nombre: string;
  edad?: number;
}

/** Por dónde entró el huésped a llenarlo. Sirve para saber qué canal funciona. */
export type OrigenPreCheckin = "correo" | "qr_reserva" | "qr_mostrador" | "recepcion";

export interface PreCheckinEntrada {
  nombreCompleto: string;
  telefono?: string;
  email?: string;
  domicilio?: string;
  ciudadOrigen?: string;
  pais?: string;
  documentoTipo?: string;
  /** Últimos dígitos, NUNCA la imagen. */
  documentoRef?: string;
  acompanantes?: Acompanante[];
  horaEstimada?: string;
  placas?: string;
  /** PNG en data-URI, dibujada con el dedo. */
  firma?: string;
  aceptaReglamento: boolean;
  aceptaPrivacidad: boolean;
  origen: OrigenPreCheckin;
  ip?: string;
}

export interface PreCheckinGuardado extends PreCheckinEntrada {
  id: string;
  bookingId: string;
  creadoEn: string;
}

interface Fila {
  id: string;
  booking_id: string;
  nombre_completo: string | null;
  telefono: string | null;
  email: string | null;
  domicilio: string | null;
  ciudad_origen: string | null;
  pais: string | null;
  documento_tipo: string | null;
  documento_ref: string | null;
  acompanantes: unknown;
  hora_estimada: string | null;
  placas: string | null;
  firma: string | null;
  acepta_reglamento: boolean | null;
  acepta_privacidad: boolean | null;
  origen: string | null;
  ip: string | null;
  created_at: string | null;
}

function mapear(f: Fila): PreCheckinGuardado {
  return {
    id: f.id,
    bookingId: f.booking_id,
    nombreCompleto: f.nombre_completo ?? "",
    telefono: f.telefono ?? "",
    email: f.email ?? "",
    domicilio: f.domicilio ?? "",
    ciudadOrigen: f.ciudad_origen ?? "",
    pais: f.pais ?? "",
    documentoTipo: f.documento_tipo ?? "",
    documentoRef: f.documento_ref ?? "",
    acompanantes: Array.isArray(f.acompanantes) ? (f.acompanantes as Acompanante[]) : [],
    horaEstimada: f.hora_estimada ?? "",
    placas: f.placas ?? "",
    firma: f.firma ?? "",
    aceptaReglamento: Boolean(f.acepta_reglamento),
    aceptaPrivacidad: Boolean(f.acepta_privacidad),
    origen: (f.origen ?? "correo") as OrigenPreCheckin,
    ip: f.ip ?? "",
    creadoEn: f.created_at ?? "",
  };
}

/**
 * Guarda (o rehace) el registro de una reserva.
 *
 * Un registro por reserva: el índice único de `booking_id` lo garantiza y el
 * upsert lo rehace si el huésped lo llena dos veces —cambió de acompañantes, se
 * equivocó en la firma—. Sin esto, un segundo envío reventaría contra el índice
 * y el huésped vería un error sin entender por qué.
 */
export async function guardarPreCheckin(
  hotelId: string,
  bookingId: string,
  datos: PreCheckinEntrada,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createAdminClient();
  try {
    await escribir(
      "preCheckin.guardar",
      supabase.from("pre_checkins").upsert(
        {
          hotel_id: hotelId,
          booking_id: bookingId,
          nombre_completo: datos.nombreCompleto,
          telefono: datos.telefono ?? null,
          email: datos.email ?? null,
          domicilio: datos.domicilio ?? null,
          ciudad_origen: datos.ciudadOrigen ?? null,
          pais: datos.pais ?? null,
          documento_tipo: datos.documentoTipo ?? null,
          documento_ref: datos.documentoRef ?? null,
          acompanantes: datos.acompanantes ?? [],
          hora_estimada: datos.horaEstimada ?? null,
          placas: datos.placas ?? null,
          firma: datos.firma ?? null,
          acepta_reglamento: datos.aceptaReglamento,
          acepta_privacidad: datos.aceptaPrivacidad,
          origen: datos.origen,
          ip: datos.ip ?? null,
        },
        { onConflict: "booking_id" },
      ),
    );
    return { ok: true };
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e);
    // El SQL lo corre Manolo a mano: entre el despliegue y ese momento la tabla
    // no existe. Distinguirlo evita que el huésped vea "algo salió mal" cuando
    // lo que falta es un paso de instalación. Mismo remedio que en checkinBooking.
    if (/pre_checkins/.test(mensaje)) return { ok: false, error: "falta-tabla" };
    console.error("[preCheckin.guardar]", mensaje);
    return { ok: false, error: "no-guardado" };
  }
}

/** ¿Ya se registró esta reserva? Devuelve sólo el hecho, no los datos. */
export async function tienePreCheckin(hotelId: string, bookingId: string): Promise<boolean> {
  const supabase = createAdminClient();
  try {
    const fila = await leer(
      "preCheckin.existe",
      supabase
        .from("pre_checkins")
        .select("id")
        .eq("hotel_id", hotelId)
        .eq("booking_id", bookingId)
        .maybeSingle(),
    );
    return Boolean(fila);
  } catch {
    // Sin la tabla (o con Supabase caído) se responde "no hay registro": el
    // huésped puede volver a llenarlo, que es el fallo inofensivo. Decir que sí
    // lo hay le cerraría la puerta sin remedio.
    return false;
  }
}

/** El registro completo de una reserva, para la ficha del panel. */
export async function getPreCheckin(
  hotelId: string,
  bookingId: string,
): Promise<PreCheckinGuardado | null> {
  const supabase = createAdminClient();
  try {
    const fila = (await leer(
      "preCheckin.porReserva",
      supabase
        .from("pre_checkins")
        .select("*")
        .eq("hotel_id", hotelId)
        .eq("booking_id", bookingId)
        .maybeSingle(),
    )) as Fila | null;
    return fila ? mapear(fila) : null;
  } catch {
    return null;
  }
}

/** Los `booking_id` de este hotel que YA tienen registro. Para pintar la lista. */
export async function bookingsConPreCheckin(hotelId: string): Promise<Set<string>> {
  const supabase = createAdminClient();
  try {
    const filas = (await leer(
      "preCheckin.delHotel",
      supabase.from("pre_checkins").select("booking_id").eq("hotel_id", hotelId),
    )) as { booking_id: string }[] | null;
    return new Set((filas ?? []).map((f) => f.booking_id));
  } catch {
    return new Set();
  }
}

/**
 * Enciende o apaga el correo de registro previo de un hotel.
 *
 * Vive en `hoteles.config.pre_checkin_enabled`, mismo sitio y mismo patrón que
 * `bot_enabled`: se relee el jsonb y se escribe fundido, para no borrar las
 * claves que puso otra pantalla.
 *
 * Apagado por defecto A PROPÓSITO: con 11 hoteles en la flota, encenderlo para
 * todos significaría que a los huéspedes de diez hoteles les empieza a llegar un
 * correo que su hotelero no pidió ni sabe que existe.
 */
export async function setPreCheckinEmail(hotelId: string, activo: boolean): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hoteles")
    .select("config")
    .eq("id", hotelId)
    .maybeSingle();
  if (error) {
    console.error("setPreCheckinEmail leer:", error.message);
    return false;
  }
  const actual = (data as { config: Record<string, unknown> | null } | null)?.config ?? {};
  const { error: errEscribir } = await supabase
    .from("hoteles")
    .update({ config: { ...actual, pre_checkin_enabled: activo } })
    .eq("id", hotelId);
  if (errEscribir) {
    console.error("setPreCheckinEmail escribir:", errEscribir.message);
    return false;
  }
  return true;
}
