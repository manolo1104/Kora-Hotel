import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnvReady } from "@/lib/supabase/env";
import { destinoSeguro } from "@/lib/destino-seguro";

// Recibe el código del enlace mágico / confirmación de correo y crea la sesión.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Solo rutas internas. Esta comprobación estaba escrita a mano aquí y era MÁS
  // DÉBIL que la de `/entrar`: no rechazaba `/\`, que varios navegadores tratan
  // igual que `//`. Y justo aquí es donde más duele — este es el enlace que
  // llega POR CORREO.
  const next = destinoSeguro(searchParams.get("next")) ?? "/panel";

  if (code && supabaseEnvReady) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  // `/entrar` lee `error=enlace` y explica qué pasó (caducó, ya se usó o se
  // abrió en otro navegador: el canje necesita la clave que guardó el navegador
  // que PIDIÓ el enlace). Se conserva el destino: antes se perdía, y quien venía
  // a cargar su hotel o a pagar acababa en el panel vacío tras pedir otro enlace.
  const destino = next !== "/panel" ? `&next=${encodeURIComponent(next)}` : "";
  return NextResponse.redirect(`${origin}/entrar?error=enlace${destino}`);
}
