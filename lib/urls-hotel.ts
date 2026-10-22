import { TENANTS_PRUEBA } from "@/lib/seo";
import { bloqueoDelHotel } from "@/lib/suscripcion";

// Qué hoteles y qué páginas suyas se le anuncian a Google y a las IA.
//
// 🔴 POR QUÉ EXISTE. Hasta el 22 oct 2026 cada superficie decidía sola: el
// sitemap filtraba hoteles de prueba Y bloqueados, pero llms.txt, el llms.txt de
// cada hotel y las páginas /hoteles-en/[ciudad] sólo filtraban los de prueba.
// Resultado: ChatGPT y los visitantes recibían enlaces a hoteles bloqueados, que
// el layout de /h/[slug] apaga con un 404. Una sola regla para todos.

/** El hotel se puede anunciar: no es semilla de prueba y Kora no lo bloqueó. */
export function hotelAnunciable(slug: string | null | undefined, extras: unknown): boolean {
  if (!slug || TENANTS_PRUEBA.has(slug)) return false;
  return !bloqueoDelHotel(extras as Record<string, unknown> | null);
}

/**
 * Habitaciones con página propia (/h/slug/habitacion/idx): sólo las que tienen
 * nombre. El índice es la posición en el arreglo, igual que la ruta.
 */
export function habitacionesConPagina(
  habitaciones: unknown,
): { idx: number; nombre: string }[] {
  const lista: { nombre?: string }[] = Array.isArray(habitaciones) ? habitaciones : [];
  return lista
    .map((room, idx) => ({ idx, nombre: (room?.nombre ?? "").trim() }))
    .filter(({ nombre }) => nombre);
}
