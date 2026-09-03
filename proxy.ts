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

  // Aquí vivía la cookie `kora_active_slug`, que recordaba el último hotel que
  // se tocó. Se retiró el 2 sep 2026 (paso 5.3): una cookie es del NAVEGADOR
  // ENTERO, no de la pestaña, y con dos hoteles abiertos las pestañas se
  // pisaban. El hotel activo sale de la pestaña —cabecera `x-kora-hotel` o
  // `Referer`— desde la Etapa 5; la cookie quedó de respaldo, autodenunciándose
  // por correo, y en 7 días de producción no se usó ni una vez. El razonamiento
  // completo y las dos pruebas están en `lib/panel/active-hotel.ts`.
  //
  // Las que sigan en el navegador de alguien caducan solas (llevaban 12 h de
  // `maxAge`) y ya no las lee nadie.

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
