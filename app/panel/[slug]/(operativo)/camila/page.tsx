import { requireHotelMember } from "@/lib/tenant";
import { motivoCierre } from "@/lib/panel/pantallas";
import { SinPermiso, pantallaDe } from "@/components/panel/SinPermiso";
import { diagnosticarHotel } from "@/lib/panel/diagnostico";
import { accesoDelHotel, puedeUsarCamila } from "@/lib/suscripcion";
import { cobrosListosDelHotel } from "@/lib/motor/modo-prueba";
import CamilaClient from "./CamilaClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Tu asistente de WhatsApp | Kora", robots: { index: false } };

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
        titulo="Camila · WhatsApp"
        quien="encargada"
        motivo={cierre}
        volverA={pantallaDe(ctx.rol, slug, ctx.pantallas)}
      />
    );
  }
  const diagnostico = diagnosticarHotel(ctx.hotel);
  const [acceso, cobrosListos] = await Promise.all([
    accesoDelHotel(ctx.hotel),
    // La cuenta de Stripe COBRA de verdad (no basta con que exista): es lo que
    // decide si la asistente puede mandar link de pago.
    cobrosListosDelHotel(ctx.hotel.id, ctx.hotel.stripe_account_id),
  ]);
  return (
    <CamilaClient
      slug={slug}
      hotelNombre={ctx.hotel.nombre}
      whatsappHotel={ctx.hotel.whatsapp ?? ""}
      diagnostico={diagnostico}
      camilaPermitida={puedeUsarCamila(acceso, ctx.hotel)}
      cobrosListos={cobrosListos}
    />
  );
}
