import { notFound } from "next/navigation";
import { resolveHotel } from "@/lib/tenant";
import { hotelRooms } from "@/lib/booking";
import { COLOR_DEFAULT, inkFor, fontStack, type MiniExtras } from "@/lib/mini";
import ReservarClient from "./ReservarClient";

export const dynamic = "force-dynamic";

// Motor de reservas PÚBLICO y embebible por hotel. Server component delgado:
// resuelve el hotel por slug (sin auth), pasa los cuartos y el branding al cliente.
export default async function ReservarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hotel = await resolveHotel(slug);
  if (!hotel) notFound();

  const rooms = hotelRooms(hotel);

  // Branding del hotel (mismo origen que /h/[slug]): color de marca en extras.diseno.
  const extras = (hotel.extras ?? {}) as MiniExtras;
  const diseno = extras.diseno ?? {};
  const color = diseno.color || COLOR_DEFAULT;

  return (
    <ReservarClient
      slug={slug}
      hotelNombre={hotel.nombre}
      whatsapp={hotel.whatsapp}
      rooms={rooms}
      brandColor={color}
      brandInk={inkFor(color)}
      fontStack={fontStack(diseno.fuente)}
    />
  );
}
