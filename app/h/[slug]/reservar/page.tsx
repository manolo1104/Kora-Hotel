import { notFound } from "next/navigation";
import { resolveHotel } from "@/lib/tenant";
import { hotelRooms } from "@/lib/booking";
import { COLOR_DEFAULT, inkFor, fontStack, type MiniExtras } from "@/lib/mini";
import { ownerTienePlanActivo } from "@/lib/suscripcion";
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
  const acento = diseno.acento || color; // si no hay acento, usa el color de marca

  // Quitar la marca de Kora es premium: solo se respeta con plan activo del dueño.
  const marcaOculta =
    extras.premium?.marcaOculta === true && (await ownerTienePlanActivo(hotel.owner_id));

  // Portada: la 1ª foto del hotel como banner (a menos que el dueño lo desactive).
  const coverUrl = diseno.portada !== false && hotel.fotos?.[0] ? hotel.fotos[0] : null;

  return (
    <ReservarClient
      slug={slug}
      hotelNombre={hotel.nombre}
      whatsapp={hotel.whatsapp}
      rooms={rooms}
      brandColor={color}
      brandInk={inkFor(color)}
      accentColor={acento}
      accentInk={inkFor(acento)}
      fontStack={fontStack(diseno.fuente)}
      logoUrl={diseno.logoUrl || null}
      coverUrl={coverUrl}
      marcaOculta={marcaOculta}
    />
  );
}
