import { notFound } from "next/navigation";
import { resolveHotel } from "@/lib/tenant";
import { bloqueoDelHotel } from "@/lib/suscripcion";

// A propósito SIN `dynamic = "force-dynamic"`. Estaba, y como la configuración
// de un layout arrastra a todo lo que cuelga de él, anulaba el `revalidate =
// 3600` de las entradas del blog: cada visita a un artículo pasaba a golpear la
// base. Y era redundante: /h/[slug], /reservar, /[pagina], /habitacion/[idx] y
// /resena ya declaran `force-dynamic` cada una, así que en todas ellas el
// bloqueo sigue surtiendo efecto al instante. La única que hereda caché es el
// blog: un hotel recién bloqueado puede seguir mostrando sus artículos hasta una
// hora. Es el precio correcto — el motor de reservas y la página del hotel, que
// son lo que importa, se apagan en el acto.

/**
 * Puerta de entrada de TODO el sitio público de un hotel (/h/[slug] y todo lo
 * que cuelga: página, habitaciones, blog, motor de reservas, reseñas).
 *
 * Si Kora bloqueó la cuenta, el sitio entero desaparece con un 404. Es distinto
 * a la prueba vencida: ahí la página SÍ se queda en línea, solo que sin motor y
 * empujando al WhatsApp del hotel. Para una cuenta bloqueada eso sería peor que
 * nada, porque su bot también está apagado y el huésped escribiría a un número
 * donde nadie contesta.
 *
 * Nada se borra: en cuanto se quita el bloqueo, el sitio vuelve tal cual estaba.
 */
export default async function HotelPublicoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hotel = await resolveHotel(slug);

  if (hotel && bloqueoDelHotel(hotel.extras as Record<string, unknown> | null)) {
    notFound();
  }

  // Si el hotel no existe, no se decide aquí: cada página ya maneja su propio
  // 404 (y así el mensaje sigue siendo el suyo).
  return <>{children}</>;
}
