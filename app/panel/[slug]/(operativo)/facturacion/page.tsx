import { getAllBookings } from "@/lib/db/admin";
import { facturamaConfigured, facturamaIsSandbox } from "@/lib/admin/facturama";
import { requireHotelMember } from "@/lib/tenant";
import FacturacionClient from "./FacturacionClient";

export const dynamic = "force-dynamic";

export default async function FacturacionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);

  const bookings = await getAllBookings(ctx.hotelId);
  // Solo reservas facturables: confirmadas/manuales con monto.
  const facturables = bookings
    .filter((b) => b.estado !== "CANCELADA" && b.total > 0)
    .slice(0, 100);

  return (
    <FacturacionClient
      bookings={facturables}
      facturama={{
        configured: facturamaConfigured(),
        sandbox: facturamaIsSandbox(),
      }}
    />
  );
}
