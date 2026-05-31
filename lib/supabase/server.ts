import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

// Cliente para Server Components / Route Handlers. cookies() es asíncrono en
// Next 16. Llamar solo cuando supabaseEnvReady sea true.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Se llamó desde un Server Component (sin permiso de escritura de
          // cookies); el middleware se encarga de refrescar la sesión.
        }
      },
    },
  });
}
