import { cookies } from "next/headers";
import { createHash, timingSafeEqual } from "crypto";

// Login del CRM por contraseña simple (separado del Supabase Auth de los dueños).
// La contraseña vive en CRM_PASSWORD (server-only). La cookie guarda un hash,
// no la contraseña en claro.

const COOKIE = "kora_crm";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

/**
 * La contraseña del CRM, o null si no hay ninguna configurada.
 *
 * Antes esto caía a una contraseña por defecto escrita en el propio archivo. El
 * repositorio es PÚBLICO, así que esa contraseña de respaldo era de dominio
 * público: el día que `CRM_PASSWORD` faltara en el entorno —un despliegue nuevo,
 * una variable borrada por error— el CRM con todos los leads quedaría abierto con
 * una contraseña que cualquiera puede leer en GitHub. Ahora falla cerrado: sin la
 * variable no hay contraseña válida y nadie entra.
 */
export function crmPassword(): string | null {
  const p = process.env.CRM_PASSWORD;
  return p ? p : null;
}

/** Token que se guarda en la cookie (hash de la contraseña + sal fija). */
export function crmToken(): string | null {
  const p = crmPassword();
  if (!p) return null;
  return createHash("sha256").update(`${p}::kora-crm-v1`).digest("hex");
}

export function passwordOk(input: string): boolean {
  const p = crmPassword();
  if (!p || typeof input !== "string") return false;
  // Comparación de tiempo constante. Se comparan los hashes y no las cadenas en
  // claro para que ambos lados midan siempre lo mismo y la longitud de la
  // contraseña no se filtre por el tiempo de respuesta.
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(p).digest();
  return timingSafeEqual(a, b);
}

export async function isCrmAuthed(): Promise<boolean> {
  const token = crmToken();
  if (!token) return false;
  const store = await cookies();
  return store.get(COOKIE)?.value === token;
}

export async function setCrmCookie(): Promise<void> {
  const token = crmToken();
  if (!token) throw new Error("CRM_PASSWORD no está configurada");
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function clearCrmCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** Para route handlers: devuelve null si OK, o una Response 401 si no. */
export async function requireCrmAuth(): Promise<Response | null> {
  if (await isCrmAuthed()) return null;
  return new Response(JSON.stringify({ error: "No autorizado" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
