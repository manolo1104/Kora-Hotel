import { requireHotelMember } from "@/lib/tenant";
import PagosClient from "./PagosClient";

export const dynamic = "force-dynamic";

export default async function PagosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);
  return <PagosClient rol={ctx.rol} hotelNombre={ctx.hotel.nombre} />;
}
