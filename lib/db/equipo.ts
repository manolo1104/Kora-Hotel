// Quién trabaja en el hotel y con qué rol.
//
// POR QUÉ EXISTE: los cinco roles (`dueno`, `encargada`, `recepcion`,
// `limpieza`, `cocina`) y todo su mapa de permisos existían desde el principio,
// pero NO había forma de dar de alta a nadie: `hotel_members` sólo se escribía
// al crear el hotel. Un hotelero probando Kora lo dijo tal cual: "no veo dónde
// crear un usuario para camarista".
//
// No hace falta tabla de invitaciones: Kora ya permite entrar con enlace al
// correo (`signInWithOtp` en AuthForm), así que basta con que la persona exista
// en `auth.users` y tenga su fila en `hotel_members`. Se le da de alta con su
// correo y entra sola, sin que nadie le tenga que pasar una contraseña.
import { createAdminClient } from "@/lib/supabase/admin";
import { leer } from "@/lib/db/result";
import type { RolHotel } from "@/lib/tenant";

export interface MiembroHotel {
  id: string;
  userId: string;
  email: string;
  rol: RolHotel;
  desde: string;
  /** Aún no ha entrado ni una vez: sirve para avisar "todavía no ha entrado". */
  nuncaEntro: boolean;
}

/** Etiquetas en español para el panel; el `valor` es lo que guarda la BD. */
export const ROLES: { valor: RolHotel; nombre: string; que: string }[] = [
  { valor: "dueno", nombre: "Dueño", que: "Todo, incluido el dinero, el bot y dar de alta gente." },
  { valor: "encargada", nombre: "Encargada / Gerente", que: "Todo lo operativo y el sitio. No toca cobros ni da de alta gente." },
  { valor: "recepcion", nombre: "Recepción", que: "Reservas, cotizaciones, clientes y calendario. No cancela reservas." },
  { valor: "limpieza", nombre: "Limpieza / Camarista", que: "Ve las reservas del día y registra limpieza y mantenimiento." },
  { valor: "cocina", nombre: "Cocina", que: "Sólo consulta: cuántos huéspedes hay y quién llega." },
];

export const ROLES_VALIDOS = ROLES.map((r) => r.valor);

const normalizarCorreo = (e: string) => e.trim().toLowerCase();

/** El equipo del hotel, con el correo de cada quien. */
export async function getEquipo(hotelId: string): Promise<MiembroHotel[]> {
  const supabase = createAdminClient();
  const filas = await leer<Array<{ id: string; user_id: string; rol: RolHotel; created_at: string }>>(
    "equipo.listar",
    supabase
      .from("hotel_members")
      .select("id, user_id, rol, created_at")
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: true }),
  );
  if (!filas?.length) return [];

  // El correo vive en auth.users, que no se puede unir con select(): se resuelve
  // uno por uno con la API de admin. Son pocos (el equipo de un hotel pequeño).
  const conCorreo = await Promise.all(
    filas.map(async (f) => {
      let email = "";
      let nuncaEntro = false;
      try {
        const { data } = await supabase.auth.admin.getUserById(f.user_id);
        email = data.user?.email ?? "";
        nuncaEntro = !data.user?.last_sign_in_at;
      } catch (e) {
        // Un correo que no se pudo leer no puede borrar a la persona de la
        // lista: se muestra sin correo antes que desaparecer en silencio.
        console.error("[equipo] no se pudo leer el usuario", f.user_id, e);
      }
      return {
        id: f.id,
        userId: f.user_id,
        email,
        rol: f.rol,
        desde: f.created_at,
        nuncaEntro,
      };
    }),
  );
  return conCorreo;
}

type Alta =
  | { ok: true; email: string; creado: boolean }
  | { ok: false; error: string };

/**
 * Da de alta a alguien en el hotel por su correo.
 *
 * Si la persona ya tiene cuenta en Kora, se le añade el hotel. Si no, se le crea
 * la cuenta con el correo confirmado: entra con "Enlace al correo" desde
 * /entrar, sin que nadie le tenga que pasar una contraseña.
 */
export async function altaMiembro(
  hotelId: string,
  emailCrudo: string,
  rol: RolHotel,
): Promise<Alta> {
  const email = normalizarCorreo(emailCrudo);
  const supabase = createAdminClient();

  // ¿Ya existe? listUsers no filtra por correo, así que se pagina. Con el
  // volumen de Kora (decenas de usuarios) esto es una sola página.
  let userId = "";
  let creado = false;
  try {
    for (let pagina = 1; pagina <= 20 && !userId; pagina++) {
      const { data, error } = await supabase.auth.admin.listUsers({ page: pagina, perPage: 200 });
      if (error) throw error;
      const encontrado = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
      if (encontrado) userId = encontrado.id;
      if (data.users.length < 200) break;
    }
  } catch (e) {
    console.error("[equipo] listUsers falló:", e);
    return { ok: false, error: "no-se-pudo-buscar" };
  }

  if (!userId) {
    try {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        // Confirmado a propósito: quien lo da de alta es el dueño del hotel, y
        // sin esto la persona no puede entrar con enlace al correo.
        email_confirm: true,
      });
      if (error || !data.user) throw error ?? new Error("sin usuario");
      userId = data.user.id;
      creado = true;
    } catch (e) {
      console.error("[equipo] createUser falló:", e);
      return { ok: false, error: "no-se-pudo-crear" };
    }
  }

  // `unique (hotel_id, user_id)`: si ya estaba, se actualiza su rol en vez de
  // reventar con un error de duplicado que el hotelero no entendería.
  const { error } = await supabase
    .from("hotel_members")
    .upsert({ hotel_id: hotelId, user_id: userId, rol }, { onConflict: "hotel_id,user_id" });
  if (error) {
    console.error("[equipo] upsert membresía falló:", error.message);
    return { ok: false, error: "no-se-pudo-guardar" };
  }
  return { ok: true, email, creado };
}

/** Cambia el rol de alguien que ya está en el hotel. */
export async function cambiarRol(
  hotelId: string,
  userId: string,
  rol: RolHotel,
): Promise<{ ok: boolean; error?: string }> {
  const guarda = await protegerUltimoDueno(hotelId, userId, rol);
  if (guarda) return { ok: false, error: guarda };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("hotel_members")
    .update({ rol })
    .eq("hotel_id", hotelId)
    .eq("user_id", userId);
  if (error) {
    console.error("[equipo] cambiarRol falló:", error.message);
    return { ok: false, error: "no-se-pudo-guardar" };
  }
  return { ok: true };
}

/** Saca a alguien del hotel. No borra su cuenta: sólo deja de ser miembro. */
export async function quitarMiembro(
  hotelId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const guarda = await protegerUltimoDueno(hotelId, userId, null);
  if (guarda) return { ok: false, error: guarda };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("hotel_members")
    .delete()
    .eq("hotel_id", hotelId)
    .eq("user_id", userId);
  if (error) {
    console.error("[equipo] quitarMiembro falló:", error.message);
    return { ok: false, error: "no-se-pudo-guardar" };
  }
  return { ok: true };
}

/**
 * Impide dejar al hotel sin ningún dueño.
 *
 * Sin esto, el único dueño puede bajarse a "recepción" o quitarse a sí mismo y
 * el hotel queda sin nadie que pueda tocar cobros, el bot ni dar de alta gente
 * — y nadie de adentro podría arreglarlo.
 *
 * @param rolNuevo el rol al que se le quiere mover, o null si se le quita.
 * @returns el código de error si la operación dejaría el hotel sin dueño.
 */
async function protegerUltimoDueno(
  hotelId: string,
  userId: string,
  rolNuevo: RolHotel | null,
): Promise<string | null> {
  if (rolNuevo === "dueno") return null; // sigue siendo dueño: no hay riesgo

  const supabase = createAdminClient();
  const duenos = await leer<Array<{ user_id: string }>>(
    "equipo.duenos",
    supabase
      .from("hotel_members")
      .select("user_id")
      .eq("hotel_id", hotelId)
      .eq("rol", "dueno"),
  );
  if (duenos === null) return "no-se-pudo-verificar"; // ante la duda, no tocar
  const esDueno = duenos.some((d) => d.user_id === userId);
  if (esDueno && duenos.length <= 1) return "ultimo-dueno";
  return null;
}
