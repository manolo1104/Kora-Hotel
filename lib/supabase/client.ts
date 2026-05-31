import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./env";

// Cliente para componentes de navegador ("use client").
// Llamar solo cuando supabaseEnvReady sea true.
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
