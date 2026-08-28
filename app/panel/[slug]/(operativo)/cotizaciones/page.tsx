import { requireHotelMember } from '@/lib/tenant';
import { puede } from "@/lib/panel/permisos";
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
  if (!puede(ctx.rol, "cotizaciones:leer")) {
    return <SinPermiso titulo="Cotizaciones" quien="recepcion" volverA={pantallaDe(ctx.rol, slug)} />;
  }
  const quotes = await getAllQuotes(ctx.hotelId);
  const rooms = hotelRooms(ctx.hotel);
  return <CotizacionesClient initialQuotes={quotes} rooms={rooms} slug={slug} />;
}
