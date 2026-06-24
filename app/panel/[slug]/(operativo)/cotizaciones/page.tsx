import { requireHotelMember } from '@/lib/tenant';
import { getAllQuotes } from '@/lib/db/admin';
import { hotelRooms } from '@/lib/booking';
import CotizacionesClient from './CotizacionesClient';

export const dynamic = 'force-dynamic';

export default async function CotizacionesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);
  const quotes = await getAllQuotes(ctx.hotelId);
  const rooms = hotelRooms(ctx.hotel);
  return <CotizacionesClient initialQuotes={quotes} rooms={rooms} slug={slug} />;
}
