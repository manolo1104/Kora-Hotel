import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

// Cliente con service-role: SOLO servidor. Salta RLS, así que NUNCA debe
// importarse en componentes de cliente. Lo usa el CRM (route handlers /api/crm)
// que están protegidos por la contraseña.
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** true solo cuando la URL y la service-role key están configuradas. */
export const adminEnvReady = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

export function createAdminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
