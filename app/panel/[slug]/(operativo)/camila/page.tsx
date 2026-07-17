import { requireHotelMember } from "@/lib/tenant";
import { diagnosticarHotel } from "@/lib/panel/diagnostico";
import CamilaClient from "./CamilaClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Camila (bot) | Kora", robots: { index: false } };

export default async function CamilaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Gate: redirige si no hay sesión / no es miembro. El entrenamiento lo carga el
  // cliente vía /api/admin/bot-config; el diagnóstico se computa aquí (server).
  const ctx = await requireHotelMember(slug);
  const diagnostico = diagnosticarHotel(ctx.hotel);
  return (
    <CamilaClient
      slug={slug}
      hotelNombre={ctx.hotel.nombre}
      whatsappHotel={ctx.hotel.whatsapp ?? ""}
      diagnostico={diagnostico}
    />
  );
}
