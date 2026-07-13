// Herramienta de disponibilidad de Camila. Fuente ÚNICA que usan /api/agent
// (bot vivo) y /api/admin/bot-preview (chat de prueba). SOLO servidor, lectura.

import {
  hotelRooms,
  roomNamesOf,
  nightOpts,
  calcRoomStayTotal,
  formatMXN,
} from "@/lib/booking";
import { checkAvailability } from "@/lib/db/availability";
import type { HotelRow } from "@/lib/tenant";

export interface BotAvailability {
  hotel: string;
  checkin: string;
  checkout: string;
  hayDisponibilidad: boolean;
  disponibles: {
    id: string | number;
    nombre: string;
    maxHuespedes: number;
    total: number;
    totalTexto: string;
  }[];
  linkReserva: string;
}

/** Disponibilidad real + precio total por tipo de cuarto para unas fechas. */
export async function botAvailability(
  hotel: HotelRow,
  checkin: string,
  checkout: string,
): Promise<BotAvailability> {
  const rooms = hotelRooms(hotel);
  const result = await checkAvailability(hotel.id, checkin, checkout, roomNamesOf(hotel));
  const opts = nightOpts(hotel);
  const disponibles = rooms
    .filter((r) => !result.unavailableRooms.includes(r.name))
    .map((r) => {
      const total = calcRoomStayTotal(r, r.maxGuests, checkin, checkout, opts);
      return { id: r.id, nombre: r.name, maxHuespedes: r.maxGuests, total, totalTexto: formatMXN(total) };
    });
  return {
    hotel: hotel.nombre,
    checkin,
    checkout,
    hayDisponibilidad: disponibles.length > 0,
    disponibles,
    linkReserva: `/h/${hotel.slug}/reservar`,
  };
}
