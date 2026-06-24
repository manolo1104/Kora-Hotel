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

  // Multi-tenant: al navegar el panel operativo /panel/[slug]/..., recordar el
  // slug del hotel activo en una cookie. Las rutas /api/admin/* la leen para
  // saber sobre qué hotel operar (y SIEMPRE verifican membresía). Así los
  // componentes del panel no necesitan reescribir sus fetch.
  const m = request.nextUrl.pathname.match(/^\/panel\/([^/]+)(?:\/|$)/);
  if (m && m[1]) {
    response.cookies.set("kora_active_slug", m[1], {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
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
