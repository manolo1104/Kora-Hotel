import { requireHotelMember } from "@/lib/tenant";
import { diagnosticarHotel } from "@/lib/panel/diagnostico";
import PrimerosPasos from "@/components/panel/PrimerosPasos";
import InsightsClient from "./InsightsClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Insights | Kora" };

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug); // gate; el resto lo carga el cliente
  const diagnostico = diagnosticarHotel(ctx.hotel);
  return (
    <>
      <div className="px-4 pt-6 sm:px-6">
        <PrimerosPasos slug={slug} diagnostico={diagnostico} />
      </div>
      <InsightsClient />
    </>
  );
}
