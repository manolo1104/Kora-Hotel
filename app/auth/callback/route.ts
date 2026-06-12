import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnvReady } from "@/lib/supabase/env";

// Recibe el código del enlace mágico / confirmación de correo y crea la sesión.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Solo rutas internas (evita redirecciones a otros sitios).
  const nextRaw = searchParams.get("next") ?? "/panel";
  const next = nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/panel";

  if (code && supabaseEnvReady) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/entrar?error=enlace`);
}
