import { ocupaElCuarto, estadoDelCuarto } from "@/lib/booking/estado-operativo";
import { negar } from "@/lib/panel/permisos";
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
import { hoyHotel } from "@/lib/fecha-hotel";

export const dynamic = "force-dynamic";

// Espejo exacto del CHECK de `room_statuses.estado` (y de RoomStatusType).
const PATCH_SCHEMA = z.object({
  suite: z.string().min(1).max(200),
  estado: z.enum(["DISPONIBLE", "OCUPADA", "MANTENIMIENTO", "LIMPIEZA"]),
  notas: z.string().max(2000).optional().default(""),
});

// Forma de respuesta consumida por RoomMap:
//   { suite, estado, notas, actualizacion, ocupadaPor: {cliente,checkout,huespedes,confirmacion}|null }
//
// A diferencia de Paraíso (lista fija de suites en Sheets), aquí los cuartos del
// hotel salen de tipoNamesOf(ctx.hotel). Sembramos en memoria un estado
// DISPONIBLE para cada cuarto que aún no tiene fila en room_statuses, de modo que
// el mapa muestre TODOS los cuartos del hotel aunque nunca se haya tocado su
// estado. La ocupación (ver `estadoDelCuarto`) sobrescribe el estado guardado.
export async function GET() {
  return rutaSegura("admin.roomStatus.get", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const no = negar(ctx, "operaciones:leer");
  if (no) return no;

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

  // Antes esto era `new Date().toISOString()`, o sea UTC, mientras la lista de
  // Reservas usaba la zona de México: de las 18:00 a la medianoche el mapa
  // adelantaba un día y las dos pantallas se contradecían. Ver lib/fecha-hotel.ts.
  const todayStr = hoyHotel();

  // Quién ocupa cada cuarto ahora mismo. Qué GANA (esto o el estado guardado) lo
  // decide `estadoDelCuarto` más abajo, y no es lo mismo si la llegada está
  // afirmada que si sólo la deducen las fechas.
  const occupiedMap = new Map<
    string,
    { cliente: string; checkout: string; huespedes: number; confirmacion: string; llegoYa: boolean }
  >();
  for (const b of bookings) {
    // Una sola función decide quién ocupa un cuarto, y la comparten el mapa, la
    // lista y los Insights: tenerlo escrito tres veces es lo que hacía que las
    // tres pantallas se contradijeran. Ver lib/booking/estado-operativo.ts.
    if (!ocupaElCuarto(b, todayStr)) continue;

    // habitaciones puede traer varias separadas por coma.
    for (const raw of String(b.habitaciones).split(",")) {
      const room = raw.trim();
      if (!room) continue;
      occupiedMap.set(room, {
        cliente: b.cliente,
        checkout: b.checkout,
        huespedes: b.huespedes,
        // El folio viaja para que el mapa pueda ofrecer el check-out del
        // huésped que está mostrando, sin tener que ir a buscarlo a la lista.
        confirmacion: b.confirmacion,
        // Distingue "el calendario dice que hoy entra alguien" de "ese alguien
        // ya está dentro". Sin esto, un cuarto de una llegada de hoy se pinta
        // "Ocupada" desde la medianoche y la camarista lo ve tomado horas antes
        // de que el huésped ponga un pie en el hotel.
        llegoYa: Boolean(b.checkinReal),
      });
    }
  }

  const result = Array.from(bySuite.values()).map((s) => {
    const occupied = occupiedMap.get(s.suite) ?? null;
    // La regla de qué gana —lo guardado o la ocupación— vive en lib/ y tiene
    // pruebas: es donde estaba el bug de perder el estado del cuarto.
    return { ...s, estado: estadoDelCuarto(s.estado, occupied), ocupadaPor: occupied };
  });

  return NextResponse.json(result);
  });
}

export async function PATCH(req: NextRequest) {
  return rutaSegura("admin.roomStatus.patch", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  const no = negar(ctx, "operaciones:escribir");
  if (no) return no;

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
