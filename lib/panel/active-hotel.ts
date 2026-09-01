// Resuelve el hotel activo para las rutas /api/admin/* y /api/panel/*.
//
// ANTES el slug salía SÓLO de la cookie `kora_active_slug`, que el middleware
// escribía al navegar. Una cookie es del NAVEGADOR ENTERO, no de la pestaña: si
// el hotelero abría Alma Nativa en una pestaña y Estancia Pachita en otra, la
// última que tocó ganaba, y el botón "Cancelar reserva" de la primera pestaña
// cancelaba en el hotel de la segunda. Con dueños que ya administran más de un
// hotel, esto dejó de ser teórico.
//
// Ahora hay tres fuentes, en este orden:
//   1. `x-kora-hotel` — la cabecera que pone el propio panel (HotelActivoFetch).
//   2. `Referer` — la PESTAÑA que hizo la petición. `next.config.mjs` fija
//      `Referrer-Policy: strict-origin-when-cross-origin`, que en peticiones del
//      MISMO origen manda la URL completa con su path. Por eso el servidor puede
//      saber desde qué `/panel/<slug>/…` se pulsó el botón sin tocar ninguno de
//      los 63 `fetch` del panel.
//   3. Cookie — sólo compatibilidad, y deja aviso en el log.
//
// Falsificar el `Referer` o la cabecera NO sirve de nada: `getHotelMember()`
// sigue verificando la membresía contra `hotel_members` con la sesión real. El
// nivel de confianza no baja; lo que desaparece es la confusión entre pestañas.
// SOLO servidor.

import { cookies, headers } from "next/headers";
import { getHotelMember, type TenantContext } from "@/lib/tenant";
import { bloqueoDelHotel } from "@/lib/suscripcion";
import { alertar } from "@/lib/alertas";

/** Segmentos de /panel/… que NO son el slug de un hotel. */
const RESERVADOS = new Set(["onboarding", "herramientas"]);

function slugDeRuta(pathname: string): string | null {
  const m = pathname.match(/^\/panel\/([^/?#]+)/);
  const s = m?.[1] ? decodeURIComponent(m[1]) : null;
  return s && !RESERVADOS.has(s) ? s : null;
}

export type FuenteSlug = "header" | "referer" | "cookie" | "ninguna";

/** De dónde sale el slug del hotel sobre el que se va a operar. */
export async function slugActivo(): Promise<{ slug: string | null; fuente: FuenteSlug }> {
  const h = await headers();

  const explicito = h.get("x-kora-hotel")?.trim();
  if (explicito && !RESERVADOS.has(explicito)) return { slug: explicito, fuente: "header" };

  const ref = h.get("referer");
  if (ref) {
    try {
      const s = slugDeRuta(new URL(ref).pathname);
      if (s) return { slug: s, fuente: "referer" };
    } catch {
      /* Referer basura: se ignora */
    }
  }

  const c = (await cookies()).get("kora_active_slug")?.value;
  if (c && !RESERVADOS.has(c)) return { slug: c, fuente: "cookie" };

  return { slug: null, fuente: "ninguna" };
}

export async function getActiveHotel(): Promise<TenantContext | null> {
  const { slug, fuente } = await slugActivo();
  if (!slug) return null;
  if (fuente === "cookie") {
    // El respaldo se AUTODENUNCIA. No basta con un console.warn en Vercel: nadie
    // mira esos logs, y sin mirarlos no hay forma de saber cuándo se puede
    // borrar la cookie sin romper nada. Con la alerta, el criterio para
    // ejecutar el paso 5.3 es concreto: una jornada de uso del panel sin que
    // llegue este correo.
    //
    // 👉 CÓMO COMPROBARLO: buscar en la bandeja de NOTIFY_EMAIL el asunto
    //    «🚨 Kora — el panel usó la cookie del hotel activo».
    //    Si no aparece ninguno tras un día normal de uso, se pueden borrar las
    //    DOS líneas que quedan: el `cookies().get` de abajo y el
    //    `response.cookies.set` de `proxy.ts`.
    await alertar(
      "el panel usó la cookie del hotel activo",
      `Slug ${slug}. Alguna ruta del panel llegó SIN la cabecera x-kora-hotel y ` +
        `SIN Referer, así que hubo que caer al respaldo. Ese camino es el que ` +
        `permitía que dos pestañas se pisaran. Hay que encontrarlo antes de ` +
        `borrar la cookie.`,
    );
  }
  const ctx = await getHotelMember(slug);
  if (!ctx) return null;

  // Cuenta bloqueada por Kora → se comporta como si no hubiera hotel activo, y
  // todas las rutas /api/admin/* responden 401 solas. Cierra la puerta de atrás:
  // sin esto, el dueño de una cuenta bloqueada seguiría pudiendo editar reservas
  // o mandar correos llamando a la API directo, aunque no viera el panel.
  if (bloqueoDelHotel(ctx.hotel.extras as Record<string, unknown> | null)) return null;

  return ctx;
}
