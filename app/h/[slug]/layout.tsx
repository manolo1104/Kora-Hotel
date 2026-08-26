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

  // El try NO es un descuido: es la única forma de que la pantalla de error se
  // vea. Medido con la llave de Supabase rota, en build de producción: cuando
  // `resolveHotel` lanzaba AQUÍ, la respuesta era un 500 con el cuerpo VACÍO —
  // ningún `error.tsx` alcanza lo que lanza el layout de su propio segmento, y
  // en el arranque del render aún no hay nada donde montar el de arriba.
  //
  // Dejando pasar el fallo, la MISMA lectura vuelve a hacerse en la página, que
  // sí está dentro de `app/h/[slug]/error.tsx` — y entonces el visitante ve
  // "No pudimos cargar esta página" en vez de una página en blanco.
  //
  // Lo único que se pierde durante el incidente es la comprobación de bloqueo, y
  // eso no abre ninguna puerta: la página del hotel no cobra ni guarda nada, y
  // el checkout, el panel y el bot comprueban el bloqueo por su cuenta.
  let hotel = null;
  try {
    hotel = await resolveHotel(slug);
  } catch (e) {
    console.error(`[h/${slug}/layout] no se pudo leer el hotel:`, e);
  }

  if (hotel && bloqueoDelHotel(hotel.extras as Record<string, unknown> | null)) {
    notFound();
  }

  // Si el hotel no existe, no se decide aquí: cada página ya maneja su propio
  // 404 (y así el mensaje sigue siendo el suyo).
  return <>{children}</>;
}
