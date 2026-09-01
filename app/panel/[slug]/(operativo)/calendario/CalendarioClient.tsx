'use client';

import { reservaCuenta } from "@/lib/booking/estado-reserva";
import { useState } from 'react';
import { Plus, CalendarDays, GanttChartSquare } from 'lucide-react';
import type { AdminBooking } from '@/lib/admin/sheets-admin';
import type { BookingRoom } from '@/lib/booking';
import ReservationModal from '@/components/admin/ReservationModal';
import GanttView from './GanttView';
import AvailabilityCalendar from './AvailabilityCalendar';
import styles from './calendario.module.css';

interface Props {
  slug: string;
  initialBookings: AdminBooking[];
  rooms: string[];
  roomPrices: Record<string, number>;
  bookingRooms: BookingRoom[];
  /**
   * ¿Ve los importes? Lo decide el servidor (`reservas:dinero`). Con `false`
   * desaparecen el precio por noche de cada cuarto, el total del globo del
   * Gantt y el desglose del panel de un día — y no se abre el modal de reserva,
   * que es dinero de arriba a abajo.
   */
  verDinero?: boolean;
}

export default function CalendarioClient({ slug, initialBookings, rooms, roomPrices, bookingRooms, verDinero = true }: Props) {
  const [view, setView] = useState<'calendario' | 'gantt'>('calendario');
  const [bookings, setBookings] = useState(initialBookings);
  const [modal, setModal] = useState<{ booking?: AdminBooking; defaultCheckin?: string } | null>(null);

  async function refresh() {
    const res = await fetch('/api/admin/reservas');
    if (res.ok) setBookings(await res.json());
  }

  return (
    <div>
      {/* Row 1: título + botón principal */}
      <div className={styles.headerRow1}>
        <div>
          <h1 className={styles.title}>Calendario</h1>
          <p className={styles.sub}>
            {bookings.filter(b => reservaCuenta(b.estado)).length} reservas activas
          </p>
        </div>
        {verDinero && (
          <button className={styles.primaryBtn} onClick={() => setModal({})}>
            <Plus size={15} /> Nueva reserva
          </button>
        )}
      </div>
      {/* Row 2: tabs de vista */}
      <div className={styles.headerRow2}>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${view === 'calendario' ? styles.viewBtnActive : ''}`}
            onClick={() => setView('calendario')}
          >
            <CalendarDays size={14} /> Disponibilidad
          </button>
          <button
            className={`${styles.viewBtn} ${view === 'gantt' ? styles.viewBtnActive : ''}`}
            onClick={() => setView('gantt')}
          >
            <GanttChartSquare size={14} /> Timeline
          </button>
        </div>
      </div>

      {view === 'calendario' && (
        <AvailabilityCalendar
          slug={slug}
          bookings={bookings}
          rooms={rooms}
          roomPrices={roomPrices}
          bookingRooms={bookingRooms}
          onRefresh={refresh}
          verDinero={verDinero}
        />
      )}

      {view === 'gantt' && (
        <GanttView slug={slug} bookings={bookings} rooms={rooms} bookingRooms={bookingRooms} onRefresh={refresh} verDinero={verDinero} />
      )}

      {modal && (
        <ReservationModal
          booking={modal.booking}
          defaultCheckin={modal.defaultCheckin}
          rooms={bookingRooms}
          slug={slug}
          onClose={() => setModal(null)}
          onSaved={() => { refresh(); setModal(null); }}
        />
      )}
    </div>
  );
}
