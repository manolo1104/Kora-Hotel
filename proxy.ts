import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";

// Refresca la sesión de Supabase en cada navegación (convención "proxy" de
// Next 16, antes "middleware"). Si las llaves aún no están configuradas, no
// hace nada y el sitio funciona con normalidad.
export async function proxy(request: NextRequest) {
  if (!supabaseEnvReady) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  await supabase.auth.getUser();

  // Multi-tenant: al navegar /panel/[slug]/..., se recuerda el slug en una
  // cookie. YA NO es la fuente de verdad — desde la Etapa 5 el hotel activo sale
  // de la PESTAÑA (cabecera `x-kora-hotel` o `Referer`), porque una cookie es del
  // navegador entero y con dos hoteles abiertos las pestañas se pisaban. Esto
  // queda como último respaldo, y `lib/panel/active-hotel.ts` avisa cada vez que
  // hace falta usarlo: cuando ese aviso no aparezca en una jornada completa de
  // uso del panel, la cookie se borra del todo (paso 5.3 del plan).
  //
  // `onboarding` y `herramientas` NO son slugs de hotel: entrar a
  // /panel/onboarding guardaba "onboarding" como si lo fuera.
  const RESERVADOS = new Set(["onboarding", "herramientas"]);
  const m = request.nextUrl.pathname.match(/^\/panel\/([^/]+)(?:\/|$)/);
  if (m && m[1] && !RESERVADOS.has(m[1])) {
    response.cookies.set("kora_active_slug", m[1], {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 12,
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
