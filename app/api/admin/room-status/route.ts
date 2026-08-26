import { z } from "zod";
import { rutaSegura } from "@/lib/api/responder";
import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import {
  getRoomStatuses,
  setRoomStatus,
  getAllBookings,
  type RoomStatus,
  type RoomStatusType,
} from "@/lib/db/admin";
import { unitNamesOf } from "@/lib/booking";

export const dynamic = "force-dynamic";

// Espejo exacto del CHECK de `room_statuses.estado` (y de RoomStatusType).
const PATCH_SCHEMA = z.object({
  suite: z.string().min(1).max(200),
  estado: z.enum(["DISPONIBLE", "OCUPADA", "MANTENIMIENTO", "LIMPIEZA"]),
  notas: z.string().max(2000).optional().default(""),
});

// Forma de respuesta consumida por RoomMap:
//   { suite, estado, notas, actualizacion, ocupadaPor: {cliente,checkout,huespedes}|null }
//
// A diferencia de Paraíso (lista fija de suites en Sheets), aquí los cuartos del
// hotel salen de tipoNamesOf(ctx.hotel). Sembramos en memoria un estado
// DISPONIBLE para cada cuarto que aún no tiene fila en room_statuses, de modo que
// el mapa muestre TODOS los cuartos del hotel aunque nunca se haya tocado su
// estado. La ocupación real (reservas activas hoy) sobrescribe el estado.
export async function GET() {
  return rutaSegura("admin.roomStatus.get", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const [statuses, bookings] = await Promise.all([
    getRoomStatuses(ctx.hotelId),
    getAllBookings(ctx.hotelId),
  ]);

  const roomNames = unitNamesOf(ctx.hotel);

  // Estado por suite (default DISPONIBLE para cuartos sin fila guardada).
  const bySuite = new Map<string, RoomStatus>();
  for (const name of roomNames) {
    bySuite.set(name, { suite: name, estado: "DISPONIBLE", notas: "", actualizacion: "" });
  }
  for (const s of statuses) {
    // Conserva estados guardados incluso si el cuarto ya no está en la lista.
    bySuite.set(s.suite, s);
  }

  const todayStr = new Date().toISOString().split("T")[0];

  // Ocupación derivada de reservas activas (sobrescribe el estado guardado salvo
  // MANTENIMIENTO/LIMPIEZA, que tienen prioridad operativa).
  const occupiedMap = new Map<string, { cliente: string; checkout: string; huespedes: number }>();
  for (const b of bookings) {
    if (b.estado === "CANCELADA" || !b.checkin || !b.checkout) continue;
    if (b.checkin <= todayStr && b.checkout > todayStr) {
      // habitaciones puede traer varias separadas por coma.
      for (const raw of String(b.habitaciones).split(",")) {
        const room = raw.trim();
        if (!room) continue;
        occupiedMap.set(room, {
          cliente: b.cliente,
          checkout: b.checkout,
          huespedes: b.huespedes,
        });
      }
    }
  }

  const result = Array.from(bySuite.values()).map((s) => {
    const occupied = occupiedMap.get(s.suite);
    if (occupied && s.estado !== "MANTENIMIENTO" && s.estado !== "LIMPIEZA") {
      return { ...s, estado: "OCUPADA" as RoomStatusType, ocupadaPor: occupied };
    }
    return { ...s, ocupadaPor: null };
  });

  return NextResponse.json(result);
  });
}

export async function PATCH(req: NextRequest) {
  return rutaSegura("admin.roomStatus.patch", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  // El `as RoomStatusType` de antes era una promesa que nadie comprobaba: un
  // estado inventado llegaba a Postgres, chocaba con el CHECK de la columna, y
  // ese error se perdía en un console.error mientras la ruta decía {ok:true}.
  const cuerpo = PATCH_SCHEMA.safeParse(await req.json());
  if (!cuerpo.success) {
    return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  }
  const { suite, estado, notas } = cuerpo.data;
  await setRoomStatus(ctx.hotelId, suite, estado, notas);
  return NextResponse.json({ ok: true });
  });
}
