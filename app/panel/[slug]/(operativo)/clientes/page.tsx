import { buildCRM } from "@/lib/admin/sheets-admin";
import { requireHotelMember } from "@/lib/tenant";
import ClientesClient from "./ClientesClient";

export const dynamic = "force-dynamic";

export default async function ClientesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);
  const crm = await buildCRM(ctx.hotelId);
  return <ClientesClient initialClientes={crm} slug={slug} />;
}
