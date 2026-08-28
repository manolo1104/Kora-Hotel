import { requireHotelMember } from "@/lib/tenant";
import { puede } from "@/lib/panel/permisos";
import { SinPermiso, pantallaDe } from "@/components/panel/SinPermiso";
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

  // `requireHotelMember` sólo comprueba MEMBRESÍA. Sin esto, cualquier rol
  // del hotel abría esta pantalla — y las que cargan datos en el servidor
  // (ingresos, facturación, cotizaciones, canales) se los enseñaban.
  if (!puede(ctx.rol, "ingresos:ver")) {
    return <SinPermiso titulo="Inicio" quien="encargada" volverA={pantallaDe(ctx.rol, slug)} />;
  }
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
