// Resuelve el hotel activo para las rutas /api/admin/* y /api/panel/*.
//
// ANTES el slug salía SÓLO de la cookie `kora_active_slug`, que el middleware
// escribía al navegar. Una cookie es del NAVEGADOR ENTERO, no de la pestaña: si
// el hotelero abría Alma Nativa en una pestaña y Estancia Pachita en otra, la
// última que tocó ganaba, y el botón "Cancelar reserva" de la primera pestaña
// cancelaba en el hotel de la segunda. Con dueños que ya administran más de un
// hotel, esto dejó de ser teórico.
//
// Quedan DOS fuentes, en este orden:
//   1. `x-kora-hotel` — la cabecera que pone el propio panel (HotelActivoFetch).
//   2. `Referer` — la PESTAÑA que hizo la petición. `next.config.mjs` fija
//      `Referrer-Policy: strict-origin-when-cross-origin`, que en peticiones del
//      MISMO origen manda la URL completa con su path. Por eso el servidor puede
//      saber desde qué `/panel/<slug>/…` se pulsó el botón sin tocar ninguno de
//      los 63 `fetch` del panel.
//
// LA COOKIE YA NO ESTÁ (paso 5.3 del plan, cerrado el 2 sep 2026). Era el tercer
// respaldo y se autodenunciaba por correo cada vez que hacía falta usarla. Se
// retiró con dos pruebas, no con una corazonada:
//   • SIETE DÍAS con ese aviso vivo en producción (desde el 26 ago) y CERO
//     correos «🚨 Kora — el panel usó la cookie del hotel activo» en NOTIFY_EMAIL
//     —que sí está puesto en Vercel producción, comprobado—.
//   • Las 48 rutas que llaman a getActiveHotel() se rastrearon hasta la pantalla
//     que las dispara: TODAS cuelgan de /panel/<slug>/…, donde van la cabecera y
//     el Referer. Las tres páginas que viven fuera (/panel, /panel/herramientas
//     y /panel/onboarding) no llaman a ninguna de ellas: usan /api/stripe/portal,
//     /api/panel/eliminar-hotel y /api/panel/crear-hotel, que resuelven el hotel
//     por el cuerpo de la petición o por la URL, nunca por el hotel activo.
//
// Efecto aceptado a sabiendas: abrir una URL de /api/admin/… A PELO (pegarla en
// la barra, o recargar desde el historial la pestaña que abre «imprimir») ya no
// resuelve hotel y responde 401. Desde el panel no cambia nada.
//
// Falsificar el `Referer` o la cabecera NO sirve de nada: `getHotelMember()`
// sigue verificando la membresía contra `hotel_members` con la sesión real. El
// nivel de confianza no baja; lo que desaparece es la confusión entre pestañas.
// SOLO servidor.

import { headers } from "next/headers";
import { getHotelMember, type TenantContext } from "@/lib/tenant";
import { bloqueoDelHotel } from "@/lib/suscripcion";

/** Segmentos de /panel/… que NO son el slug de un hotel. */
const RESERVADOS = new Set(["onboarding", "herramientas"]);

function slugDeRuta(pathname: string): string | null {
  const m = pathname.match(/^\/panel\/([^/?#]+)/);
  const s = m?.[1] ? decodeURIComponent(m[1]) : null;
  return s && !RESERVADOS.has(s) ? s : null;
}

export type FuenteSlug = "header" | "referer" | "ninguna";

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

  return { slug: null, fuente: "ninguna" };
}

export async function getActiveHotel(): Promise<TenantContext | null> {
  const { slug } = await slugActivo();
  if (!slug) return null;
  const ctx = await getHotelMember(slug);
  if (!ctx) return null;

  // Cuenta bloqueada por Kora → se comporta como si no hubiera hotel activo, y
  // todas las rutas /api/admin/* responden 401 solas. Cierra la puerta de atrás:
  // sin esto, el dueño de una cuenta bloqueada seguiría pudiendo editar reservas
  // o mandar correos llamando a la API directo, aunque no viera el panel.
  if (bloqueoDelHotel(ctx.hotel.extras as Record<string, unknown> | null)) return null;

  return ctx;
}
