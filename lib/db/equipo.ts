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
import { leer, DbError } from "@/lib/db/result";
import type { RolHotel } from "@/lib/tenant";
import { sanearPantallas } from "@/lib/panel/pantallas";

export interface MiembroHotel {
  id: string;
  userId: string;
  email: string;
  rol: RolHotel;
  /**
   * Pestañas que el dueño le dejó ver, o `null` = todas las de su puesto.
   * Sólo QUITA: nunca da una pantalla que el puesto no incluya.
   */
  pantallas: string[] | null;
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

/**
 * ¿El fallo es "la columna `pantallas` todavía no existe"?
 *
 * `sql/kora-equipo-pantallas.sql` se corre a mano en Supabase. Si el despliegue
 * llegara antes que el SQL, sin esta comprobación la pantalla de "Quién trabaja
 * aquí" daría un 500 en blanco — justo la pantalla donde el hotelero iría a
 * buscar qué pasó. Con ella, la pantalla sigue funcionando como antes (cada
 * quien ve todas las pestañas de su puesto) y sólo GUARDAR pestañas avisa.
 *
 * `42703` es `undefined_column` de Postgres. Se puede borrar en cuanto el SQL
 * esté corrido en producción.
 */
function faltaColumnaPantallas(e: unknown): boolean {
  return (
    e instanceof DbError && (e.code === "42703" || /pantallas/i.test(e.detalle))
  );
}

const AVISO_SQL =
  "[equipo] falta la columna hotel_members.pantallas: corre " +
  "sql/kora-equipo-pantallas.sql en Supabase.";

/** El equipo del hotel, con el correo de cada quien. */
export async function getEquipo(hotelId: string): Promise<MiembroHotel[]> {
  const supabase = createAdminClient();
  type Fila = {
    id: string;
    user_id: string;
    rol: RolHotel;
    pantallas?: string[] | null;
    created_at: string;
  };
  const listar = (cols: string) =>
    supabase
      .from("hotel_members")
      .select(cols)
      .eq("hotel_id", hotelId)
      .order("created_at", { ascending: true });

  let filas: Fila[] | null;
  try {
    filas = await leer<Fila[]>(
      "equipo.listar",
      listar("id, user_id, rol, pantallas, created_at") as never,
    );
  } catch (e) {
    if (!faltaColumnaPantallas(e)) throw e;
    console.warn(AVISO_SQL);
    filas = await leer<Fila[]>(
      "equipo.listar.sinPantallas",
      listar("id, user_id, rol, created_at") as never,
    );
  }
  if (!filas?.length) return [];

  // El correo vive en auth.users, que no se puede unir con select(): se resuelve
  // uno por uno con la API de admin. Son pocos (el equipo de un hotel pequeño).
  const conCorreo = await Promise.all(
    filas.map(async (f) => {
      let email = "";
      let nuncaEntro = false;
      try {
        // `getUserById` NO lanza cuando la API falla: devuelve `{ error }`. Sin
        // mirarlo, `data.user` venía vacío y la pantalla de equipo decía
        // «nunca entró» de alguien que sí entra — el dueño podía echar a un
        // empleado creyendo que nunca usó el panel.
        const { data, error } = await supabase.auth.admin.getUserById(f.user_id);
        if (error) throw error;
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
        pantallas: f.pantallas ?? null,
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
  pantallasCrudas?: readonly string[] | null,
): Promise<Alta> {
  const saneadas = sanearPantallas(rol, pantallasCrudas);
  if (!saneadas.ok) return { ok: false, error: saneadas.error };

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
  const fila: Record<string, unknown> = { hotel_id: hotelId, user_id: userId, rol };
  if (saneadas.pantallas) fila.pantallas = saneadas.pantallas;

  const { error } = await supabase
    .from("hotel_members")
    .upsert(fila, { onConflict: "hotel_id,user_id" });
  if (error) {
    // Sin la columna, el alta NO se pierde: se reintenta sin pantallas. Dar de
    // alta a la persona es lo importante; recortarle pestañas se hace después.
    if (error.code === "42703" && fila.pantallas) {
      console.warn(AVISO_SQL);
      const { error: e2 } = await supabase
        .from("hotel_members")
        .upsert(
          { hotel_id: hotelId, user_id: userId, rol },
          { onConflict: "hotel_id,user_id" },
        );
      if (!e2) return { ok: true, email, creado };
      console.error("[equipo] upsert membresía falló:", e2.message);
      return { ok: false, error: "no-se-pudo-guardar" };
    }
    console.error("[equipo] upsert membresía falló:", error.message);
    return { ok: false, error: "no-se-pudo-guardar" };
  }
  return { ok: true, email, creado };
}

/**
 * Cambia el puesto de alguien y/o las pestañas que ve.
 *
 * Los dos viajan JUNTOS a propósito: cambiar de puesto cambia el techo de
 * pantallas, y una selección vieja de "Limpieza" aplicada a "Recepción" le
 * escondería media pantalla sin que nadie lo hubiera pedido. Cuando cambia el
 * rol y no llegan pantallas, se vuelve a `null` (= todas las de su puesto
 * nuevo), que es lo que el dueño espera al ascender a alguien.
 */
export async function actualizarMiembro(
  hotelId: string,
  userId: string,
  cambios: { rol?: RolHotel; pantallas?: readonly string[] | null },
): Promise<{ ok: boolean; error?: string }> {
  const pedir = (cols: string) =>
    createAdminClient()
      .from("hotel_members")
      .select(cols)
      .eq("hotel_id", hotelId)
      .eq("user_id", userId)
      .maybeSingle();

  let actual: { rol: RolHotel; pantallas?: string[] | null } | null;
  let hayColumna = true;
  try {
    actual = await leer<{ rol: RolHotel; pantallas: string[] | null }>(
      "equipo.miembro",
      pedir("rol, pantallas") as never,
    );
  } catch (e) {
    if (!faltaColumnaPantallas(e)) throw e;
    console.warn(AVISO_SQL);
    hayColumna = false;
    actual = await leer<{ rol: RolHotel }>("equipo.miembro.sinPantallas", pedir("rol") as never);
  }
  if (!actual) return { ok: false, error: "no-esta-en-el-hotel" };

  // Elegir pestañas sin la columna se RECHAZA con su motivo. Aceptarlo y no
  // guardarlo sería peor: el dueño creería que su camarista dejó de ver los
  // importes cuando los sigue viendo.
  if (!hayColumna && cambios.pantallas !== undefined) {
    return { ok: false, error: "falta-sql-pantallas" };
  }

  const rol = cambios.rol ?? actual.rol;
  const guarda = await protegerUltimoDueno(hotelId, userId, rol);
  if (guarda) return { ok: false, error: guarda };

  // Si sólo cambia el puesto, las pantallas se reinician a "todas las del
  // puesto nuevo". Si vienen pantallas, mandan ellas.
  const pantallasCrudas =
    cambios.pantallas !== undefined
      ? cambios.pantallas
      : cambios.rol && cambios.rol !== actual.rol
        ? null
        : (actual.pantallas ?? null);

  const saneadas = sanearPantallas(rol, pantallasCrudas);
  if (!saneadas.ok) return { ok: false, error: saneadas.error };

  const supabase = createAdminClient();
  const cambio: Record<string, unknown> = { rol };
  if (hayColumna) cambio.pantallas = saneadas.pantallas;

  const { error } = await supabase
    .from("hotel_members")
    .update(cambio)
    .eq("hotel_id", hotelId)
    .eq("user_id", userId);
  if (error) {
    console.error("[equipo] actualizarMiembro falló:", error.message);
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
