// Resolución de tenant (hotel) para la plataforma multi-tenant. SOLO servidor.
//
// Regla de oro de aislamiento: la IDENTIDAD del usuario sale SIEMPRE de la
// sesión de Supabase (cookies httpOnly), y la PERTENENCIA al hotel se verifica
// contra hotel_members con la service-role key. El hotel_id NUNCA se toma del
// body de un request. Todo lib/db debe recibir el hotelId resuelto aquí.

import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { supabaseEnvReady } from "@/lib/supabase/env";
import { leer, DbError } from "@/lib/db/result";
import { leerSuscripcion } from "@/lib/suscripcion";
import { permisosDe } from "@/lib/panel/pantallas";
import type { Permiso } from "@/lib/panel/permisos";

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
  created_at: string | null; // ancla de la prueba de 30 días (lib/suscripcion)
}

export interface TenantContext {
  hotelId: string;
  hotel: HotelRow;
  rol: RolHotel;
  userId: string;
  /**
   * Pantallas que quien administra el hotel le marcó a esta persona, o `null` =
   * las de su puesto (lo de siempre, y lo que tienen todas las filas anteriores
   * a la columna). Ver lib/panel/pantallas.ts.
   */
  pantallas: string[] | null;
  /**
   * Lo que esta persona puede hacer DE VERDAD: lo de su puesto más lo que abren
   * las pestañas que le marcaron.
   *
   * Se calcula UNA vez aquí y viaja en el contexto a propósito. Así `negar()` y
   * `puedeCtx()` —que viven en lib/panel/permisos.ts— no tienen que importar
   * lib/panel/pantallas.ts, que a su vez importa permisos.ts: sería un ciclo de
   * módulos justo en el punto donde se decide quién ve qué.
   */
  permisos: ReadonlySet<Permiso>;
}

const HOTEL_COLS =
  "id, owner_id, slug, nombre, ubicacion, descripcion, whatsapp, habitaciones, fotos, guia, extras, config, prefijo_confirmacion, stripe_account_id, publicado, created_at";

/**
 * Lee un hotel por slug (datos públicos). Devuelve null si no existe y LANZA si
 * la consulta falla.
 *
 * La distinción importa más de lo que parece: esta función alimenta el sitio
 * público de cada hotel. Con el `null` de antes, un parpadeo de Supabase se
 * servía como un 404 perfectamente formado — y Google indexa 404. Ahora salta a
 * la pantalla de error (`app/h/[slug]/error.tsx`), que es un 500 y no se indexa.
 */
export const resolveHotel = cache(async (slug: string): Promise<HotelRow | null> => {
  if (!adminEnvReady) return null;
  const supabase = createAdminClient();
  return await leer<HotelRow>(
    "hotel.porSlug",
    supabase.from("hoteles").select(HOTEL_COLS).eq("slug", slug).maybeSingle(),
  );
});

/** Hoteles donde el usuario autenticado es miembro (para el selector). */
export async function getHotelesDelUsuario(): Promise<{ hotel: HotelRow; rol: RolHotel }[]> {
  if (!supabaseEnvReady || !adminEnvReady) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();
  // Lanza si falla: un selector vacío se lee como "no tienes hoteles", que es
  // justo lo que le diría a un hotelero que sí los tiene.
  const members = await leer<unknown[]>(
    "hotel_members.delUsuario",
    admin
      .from("hotel_members")
      .select("rol, hoteles:hotel_id (" + HOTEL_COLS + ")")
      .eq("user_id", user.id),
  );

  return (members ?? [])
    .map((m) => {
      const row = m as unknown as { rol: RolHotel; hoteles: HotelRow | null };
      return row.hoteles ? { hotel: row.hoteles, rol: row.rol } : null;
    })
    .filter((x): x is { hotel: HotelRow; rol: RolHotel } => x !== null);
}

/**
 * Tope de hoteles que una misma cuenta puede dar de alta (como dueño).
 *
 * UNA CUENTA = UN HOTEL. Es una decisión de negocio, no técnica: el plan cuesta
 * $550 al mes y `accesoDelHotel` concede el acceso por `owner_id`, así que con
 * el tope en 2 un solo dueño pagaba una vez y operaba dos hoteles.
 */
export const MAX_HOTELES_POR_CUENTA = 1;

/**
 * Cuántos hoteles es DUEÑO (owner_id) el usuario. Es la base para aplicar el
 * tope de alta: cuenta solo los hoteles propios, no los que administra como staff.
 */
export async function contarHotelesPropios(userId: string): Promise<number> {
  if (!adminEnvReady) return 0;
  const admin = createAdminClient();
  // Lanza si falla. Antes devolvía 0, así que el tope fallaba en ABIERTO: con la
  // base caída, cualquiera daba de alta hoteles sin límite.
  const { count, error } = await admin
    .from("hoteles")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);
  if (error) throw new DbError("hoteles.contarPropios", error.message, error.code);
  return count ?? 0;
}

/**
 * ¿Esta cuenta ya llegó a su tope de hoteles? Un solo sitio decide, para que el
 * panel, el onboarding y la API no puedan contestar cosas distintas.
 *
 * Las cuentas de CORTESÍA quedan exentas a propósito: son las que Kora da de
 * alta a mano, y son justo las que ya tenían dos hoteles cuando se tomó la
 * decisión. La regla nueva aplica a altas nuevas, no le apaga un hotel a nadie.
 *
 * LANZA si no se pudieron contar los hoteles (`contarHotelesPropios`). Ante un
 * error de lectura de la SUSCRIPCIÓN se falla CERRADO —se aplica el tope—:
 * regalar hoteles por un hipo de la base es exactamente lo que este tope existe
 * para impedir.
 */
export async function alcanzoTopeDeHoteles(
  userId: string,
): Promise<{ alcanzado: boolean; propios: number }> {
  const propios = await contarHotelesPropios(userId);
  if (propios < MAX_HOTELES_POR_CUENTA) return { alcanzado: false, propios };
  const { sub } = await leerSuscripcion(userId);
  return { alcanzado: sub?.estado !== "cortesia", propios };
}

/**
 * Resuelve el contexto del hotel para el usuario autenticado SIN redirigir.
 * Devuelve null si: faltan envs, no hay sesión, el hotel no existe, o el
 * usuario no es miembro. Úsalo en route handlers para responder 401/404.
 *
 * Envuelta en `cache()` de React: cada pantalla del panel resuelve el mismo
 * tenant DOS veces (`app/panel/[slug]/layout.tsx` y el layout del grupo
 * operativo), y con ella `accesoDelHotel` corría dos veces también. Eran 4
 * consultas de más a Supabase por render — latencia que el hotelero siente.
 */
export const getHotelMember = cache(async (slug: string): Promise<TenantContext | null> => {
  if (!supabaseEnvReady || !adminEnvReady) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const hotel = await resolveHotel(slug);
  if (!hotel) return null;

  const admin = createAdminClient();
  // Aquí SÍ se deja lanzar: un error leyendo membresías tiene que dar 500 en el
  // panel. Devolver null expulsaba al hotelero de su propio hotel sin decirle
  // por qué, y desde fuera se ve idéntico a "te quitaron el acceso".
  const member = await leerMembresia(admin, hotel.id, user.id);
  if (!member) return null;

  const pantallas = member.pantallas ?? null;
  return {
    hotelId: hotel.id,
    hotel,
    rol: member.rol,
    userId: user.id,
    pantallas,
    permisos: permisosDe(member.rol, pantallas),
  };
});

/**
 * La fila de `hotel_members` de esta persona en este hotel.
 *
 * Lee `pantallas` (lo que el dueño le dejó ver) y, si la COLUMNA todavía no
 * existe, vuelve a preguntar sin ella.
 *
 * POR QUÉ ESTA RED: `sql/kora-equipo-pantallas.sql` se corre a mano en Supabase.
 * Si un despliegue llegara antes que el SQL, esta consulta fallaría y —al
 * lanzar— tumbaría el panel ENTERO de los diez hoteles, no sólo la función
 * nueva. La red convierte ese error en "todavía no hay pestañas configuradas",
 * que es exactamente lo que significa. Se puede borrar en cuanto el SQL esté
 * corrido en producción; mientras tanto, cuesta una consulta sólo el día que
 * pasa.
 *
 * `42703` es `undefined_column` de Postgres. Cualquier otro error se deja
 * lanzar: es la única forma de no volver a confundir "la base falló" con "no
 * eres miembro".
 */
async function leerMembresia(
  admin: ReturnType<typeof createAdminClient>,
  hotelId: string,
  userId: string,
): Promise<{ rol: RolHotel; pantallas: string[] | null } | null> {
  const consulta = (cols: string) =>
    admin
      .from("hotel_members")
      .select(cols)
      .eq("hotel_id", hotelId)
      .eq("user_id", userId)
      .maybeSingle();

  try {
    return await leer<{ rol: RolHotel; pantallas: string[] | null }>(
      "hotel_members.rol",
      consulta("rol, pantallas") as never,
    );
  } catch (e) {
    const falta =
      e instanceof DbError &&
      (e.code === "42703" || /pantallas/i.test(e.detalle));
    if (!falta) throw e;
    console.warn(
      "[tenant] la columna hotel_members.pantallas no existe todavía: " +
        "corre sql/kora-equipo-pantallas.sql en Supabase. " +
        "Mientras tanto cada quien ve todas las pestañas de su puesto.",
    );
    const sinPantallas = await leer<{ rol: RolHotel }>(
      "hotel_members.rol.sinPantallas",
      consulta("rol") as never,
    );
    return sinPantallas ? { rol: sinPantallas.rol, pantallas: null } : null;
  }
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
