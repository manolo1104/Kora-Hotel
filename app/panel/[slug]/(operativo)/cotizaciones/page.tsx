import { requireHotelMember } from '@/lib/tenant';
import { motivoCierre } from "@/lib/panel/pantallas";
import { SinPermiso, pantallaDe } from "@/components/panel/SinPermiso";
import { getAllQuotes } from '@/lib/db/admin';
import { hotelRooms } from '@/lib/booking';
import CotizacionesClient from './CotizacionesClient';

export const dynamic = 'force-dynamic';

export default async function CotizacionesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);

  // `requireHotelMember` sólo comprueba MEMBRESÍA. Sin esto, cualquier rol
  // del hotel abría esta pantalla — y las que cargan datos en el servidor
  // (ingresos, facturación, cotizaciones, canales) se los enseñaban.
  const cierre = motivoCierre(ctx.rol, ctx.pantallas, "cotizaciones");
  if (cierre) {
    return (
      <SinPermiso
        titulo="Cotizaciones"
        quien="recepcion"
        motivo={cierre}
        volverA={pantallaDe(ctx.rol, slug, ctx.pantallas)}
      />
    );
  }
  const quotes = await getAllQuotes(ctx.hotelId);
  const rooms = hotelRooms(ctx.hotel);
  return <CotizacionesClient initialQuotes={quotes} rooms={rooms} slug={slug} />;
}
