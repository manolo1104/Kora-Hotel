import { requireHotelMember } from "@/lib/tenant";
import CamilaClient from "./CamilaClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Camila (bot) | Kora", robots: { index: false } };

export default async function CamilaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Gate: redirige si no hay sesión / no es miembro. Los datos los carga el
  // cliente vía /api/admin/bot-config (hotel de la cuenta activa).
  const ctx = await requireHotelMember(slug);
  return <CamilaClient slug={slug} hotelNombre={ctx.hotel.nombre} whatsappHotel={ctx.hotel.whatsapp ?? ""} />;
}
