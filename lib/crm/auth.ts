import { cookies } from "next/headers";
import { createHash } from "crypto";

// Login del CRM por contraseña simple (separado del Supabase Auth de los dueños).
// La contraseña vive en CRM_PASSWORD (server-only). La cookie guarda un hash,
// no la contraseña en claro.

const COOKIE = "kora_crm";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 días

export function crmPassword(): string {
  return process.env.CRM_PASSWORD || "manolitO";
}

/** Token que se guarda en la cookie (hash de la contraseña + sal fija). */
export function crmToken(): string {
  return createHash("sha256").update(`${crmPassword()}::kora-crm-v1`).digest("hex");
}

export function passwordOk(input: string): boolean {
  return typeof input === "string" && input === crmPassword();
}

export async function isCrmAuthed(): Promise<boolean> {
  const store = await cookies();
  return store.get(COOKIE)?.value === crmToken();
}

export async function setCrmCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE, crmToken(), {
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
