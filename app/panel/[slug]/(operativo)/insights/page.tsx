import { requireHotelMember } from "@/lib/tenant";
import InsightsClient from "./InsightsClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Insights | Kora" };

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  await requireHotelMember(slug); // gate; los datos los carga el cliente vía /api/admin/insights
  return <InsightsClient />;
}
