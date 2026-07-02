// Resolución de tenant (hotel) para la plataforma multi-tenant. SOLO servidor.
//
// Regla de oro de aislamiento: la IDENTIDAD del usuario sale SIEMPRE de la
// sesión de Supabase (cookies httpOnly), y la PERTENENCIA al hotel se verifica
// contra hotel_members con la service-role key. El hotel_id NUNCA se toma del
// body de un request. Todo lib/db debe recibir el hotelId resuelto aquí.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { supabaseEnvReady } from "@/lib/supabase/env";

export type RolHotel = "dueno" | "encargada" | "recepcion" | "limpieza" | "cocina";

export interface HotelRow {
  id: string;
  owner_id: string;
  slug: string;
  nombre: string;
  ubicacion: string | null;
  descripcion: string | null;
  whatsapp: string | null;
  habitaciones: unknown[];
  fotos: string[];
  guia: Record<string, unknown>;
  extras: Record<string, unknown>;
  config: Record<string, unknown>;
  prefijo_confirmacion: string | null;
  stripe_account_id: string | null;
  publicado: boolean;
}

export interface TenantContext {
  hotelId: string;
  hotel: HotelRow;
  rol: RolHotel;
  userId: string;
}

const HOTEL_COLS =
  "id, owner_id, slug, nombre, ubicacion, descripcion, whatsapp, habitaciones, fotos, guia, extras, config, prefijo_confirmacion, stripe_account_id, publicado";

/** Lee un hotel por slug (datos públicos). Devuelve null si no existe. */
export async function resolveHotel(slug: string): Promise<HotelRow | null> {
  if (!adminEnvReady) return null;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("hoteles")
    .select(HOTEL_COLS)
    .eq("slug", slug)
    .maybeSingle();
  return (data as HotelRow) ?? null;
}

/** Hoteles donde el usuario autenticado es miembro (para el selector). */
export async function getHotelesDelUsuario(): Promise<{ hotel: HotelRow; rol: RolHotel }[]> {
  if (!supabaseEnvReady || !adminEnvReady) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();
  const { data: members } = await admin
    .from("hotel_members")
    .select("rol, hoteles:hotel_id (" + HOTEL_COLS + ")")
    .eq("user_id", user.id);

  return (members ?? [])
    .map((m) => {
      const row = m as unknown as { rol: RolHotel; hoteles: HotelRow | null };
      return row.hoteles ? { hotel: row.hoteles, rol: row.rol } : null;
    })
    .filter((x): x is { hotel: HotelRow; rol: RolHotel } => x !== null);
}

/**
 * Resuelve el contexto del hotel para el usuario autenticado SIN redirigir.
 * Devuelve null si: faltan envs, no hay sesión, el hotel no existe, o el
 * usuario no es miembro. Úsalo en route handlers para responder 401/404.
 */
export async function getHotelMember(slug: string): Promise<TenantContext | null> {
  if (!supabaseEnvReady || !adminEnvReady) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const hotel = await resolveHotel(slug);
  if (!hotel) return null;

  const admin = createAdminClient();
  const { data: member } = await admin
    .from("hotel_members")
    .select("rol")
    .eq("hotel_id", hotel.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return null;

  return { hotelId: hotel.id, hotel, rol: (member as { rol: RolHotel }).rol, userId: user.id };
}

/**
 * Igual que getHotelMember pero para PÁGINAS del panel: si no hay sesión manda
 * a /entrar; si hay sesión pero no es miembro de ese hotel, manda a /panel.
 * Garantiza un TenantContext válido o corta el render con redirect().
 */
export async function requireHotelMember(slug: string): Promise<TenantContext> {
  if (!supabaseEnvReady || !adminEnvReady) redirect("/panel");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const ctx = await getHotelMember(slug);
  if (!ctx) redirect("/panel");
  return ctx;
}
