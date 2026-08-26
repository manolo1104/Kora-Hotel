"use client";

// Marca CADA petición del panel con el hotel de ESTA pestaña.
//
// El servidor (`lib/panel/active-hotel.ts`) ya resuelve el hotel por `Referer`,
// que también es por pestaña. Esta cabecera es el cinturón además de los
// tirantes, y es lo que permite jubilar la cookie sin quedar colgando de una
// cabecera que un navegador o una extensión pueden suprimir.
//
// Se parchea `window.fetch` en vez de editar los 63 sitios de llamada del panel:
// un archivo de 30 líneas hace lo mismo, y ningún `fetch` que alguien escriba
// mañana se queda fuera. El servidor sigue verificando la membresía contra
// `hotel_members` con la sesión real, así que esta cabecera NO es una
// credencial: es una aclaración de "sobre cuál de mis hoteles estoy operando".

const RESERVADOS = new Set(["onboarding", "herramientas"]);
const ALCANCE = /^\/api\/(admin|panel)\//;

declare global {
  interface Window {
    __koraFetchParcheado?: boolean;
  }
}

// A nivel de MÓDULO, no en un useEffect: React descarga todos los chunks de
// cliente antes de hidratar, así que esto corre antes de que cualquier hijo
// dispare su primera petición. Con un useEffect llegaría tarde.
if (typeof window !== "undefined" && !window.__koraFetchParcheado) {
  window.__koraFetchParcheado = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
        window.location.origin,
      );
      // El slug se lee del pathname EN EL MOMENTO de cada petición, no de un
      // estado de React: así nunca se desincroniza al navegar dentro del panel.
      const m = window.location.pathname.match(/^\/panel\/([^/?#]+)/);
      const slug = m?.[1] ? decodeURIComponent(m[1]) : null;
      if (
        url.origin === window.location.origin &&
        ALCANCE.test(url.pathname) &&
        slug &&
        !RESERVADOS.has(slug)
      ) {
        const headers = new Headers(
          init?.headers ?? (input instanceof Request ? input.headers : undefined),
        );
        headers.set("x-kora-hotel", slug);
        return original(input, { ...init, headers });
      }
    } catch {
      /* si algo falla, la petición sale tal cual: nunca romper el panel */
    }
    return original(input, init);
  };
}

export default function HotelActivoFetch() {
  return null;
}
