import { requireHotelMember } from '@/lib/tenant';
import { getAllBookings } from '@/lib/db/admin';
import { hotelRooms } from '@/lib/booking';
import ReservasClient from './ReservasClient';

export const dynamic = 'force-dynamic';

export default async function ReservasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);
  const bookings = await getAllBookings(ctx.hotelId);
  const rooms = hotelRooms(ctx.hotel);
  return <ReservasClient initialBookings={bookings} rooms={rooms} slug={slug} />;
}
