import { requireHotelMember } from "@/lib/tenant";
import { motivoCierre } from "@/lib/panel/pantallas";
import { SinPermiso, pantallaDe } from "@/components/panel/SinPermiso";
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

  // `requireHotelMember` sólo comprueba MEMBRESÍA. Sin esto, cualquier rol
  // del hotel abría esta pantalla — y las que cargan datos en el servidor
  // (ingresos, facturación, cotizaciones, canales) se los enseñaban.
  const cierre = motivoCierre(ctx.rol, ctx.pantallas, "camila");
  if (cierre) {
    return (
      <SinPermiso
        titulo="Camila (bot)"
        quien="encargada"
        motivo={cierre}
        volverA={pantallaDe(ctx.rol, slug, ctx.pantallas)}
      />
    );
  }
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
