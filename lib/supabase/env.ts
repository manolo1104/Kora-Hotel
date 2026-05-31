// Llaves públicas de Supabase. Mientras no estén configuradas, el resto del
// sitio sigue funcionando con normalidad (las funciones de cuenta se desactivan
// con gracia en vez de romper el build).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** true solo cuando ambas llaves están presentes. */
export const supabaseEnvReady = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
