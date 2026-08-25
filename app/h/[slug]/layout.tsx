import { notFound } from "next/navigation";
import { resolveHotel } from "@/lib/tenant";
import { bloqueoDelHotel } from "@/lib/suscripcion";

export const dynamic = "force-dynamic";

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
