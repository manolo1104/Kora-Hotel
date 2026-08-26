import { z } from "zod";
import { rutaSegura } from "@/lib/api/responder";
// Disponibilidad del calendario (multi-tenant, Supabase).
//
// Portado de mi-hotel/app/api/admin/disponibilidad (que leía la hoja
// "Disponibilidad" de Google Sheets). En Kora el estado vive en la tabla
// `blocks` por hotel. Esta ruta DERIVA, para cada cuarto del hotel y cada fecha,
// su estado (RESERVADO / BLOQUEADO / MANTENIMIENTO / OTA), expandiendo cada
// bloque half-open [checkin, checkout) (la noche de salida queda libre).
//
// FORMA DE RESPUESTA (idéntica a la que espera AvailabilityCalendar):
//   Record<room, Record<'YYYY-MM-DD', 'RESERVADO'|'BLOQUEADO'|'MANTENIMIENTO'|'OTA'>>
// Solo se incluyen las fechas con algún estado (las libres se omiten, igual que
// en Paraíso: una celda sin valor = LIBRE). El componente cruza estas fechas con
// las reservas (getAllBookings) para distinguir "booking" de "blocked".
//
// REGLA: el hotelId SIEMPRE sale de la sesión/slug (getActiveHotel), NUNCA del
// body. Si no hay hotel activo o el usuario no es miembro → 401. SOLO servidor.

import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { createAdminClient } from "@/lib/supabase/admin";
import { blockDates } from "@/lib/db/availability";

export const dynamic = "force-dynamic";

// Estados de `blocks` que se muestran en el calendario. HOLD (carrito) se ignora:
// es efímero y no representa una ocupación real para el panel.
const SHOWN_STATUSES = new Set(["RESERVADO", "BLOQUEADO", "MANTENIMIENTO", "OTA"]);
// Prioridad cuando varios bloques caen en la misma celda (gana el más "fuerte").
const PRIORITY: Record<string, number> = {
  RESERVADO: 4,
  OTA: 3,
  MANTENIMIENTO: 2,
  BLOQUEADO: 1,
};

interface BlockRow {
  habitacion: string;
  checkin: string;
  checkout: string;
  status: string;
}

/** Fechas 'YYYY-MM-DD' de [checkin, checkout) — half-open (salida libre). */
function dateRange(checkin: string, checkout: string): string[] {
  const start = new Date(`${checkin}T00:00:00`);
  const end = new Date(`${checkout}T00:00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return [];
  const out: string[] = [];
  for (const d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function isoToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Una fecha mal formada hacía que `addDays` produjera un Invalid Date y que
// `toISOString()` lanzara un RangeError sin manejar: 500 sin explicación. Se
// valida antes de tocarla.
const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "fecha inválida (YYYY-MM-DD)");
const CUARTO_FECHA = z.object({ room: z.string().min(1).max(200), date: FECHA });

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (opcionales) — por defecto los próximos N meses.
// Devuelve Record<room, Record<dateISO, status>>.
export async function GET(req: NextRequest) {
  return rutaSegura("admin.disponibilidad.get", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  const url = new URL(req.url);
  const today = isoToday();
  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");
  if ((fromRaw && !FECHA.safeParse(fromRaw).success) || (toRaw && !FECHA.safeParse(toRaw).success)) {
    return NextResponse.json({ error: "Fechas inválidas (YYYY-MM-DD)." }, { status: 400 });
  }
  const from = fromRaw || today;
  let to = toRaw;
  if (!to) {
    const d = new Date(`${from}T00:00:00`);
    d.setMonth(d.getMonth() + 12); // ventana amplia por defecto (1 año)
    to = d.toISOString().slice(0, 10);
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  // Solape con [from, to): b.checkin < to AND b.checkout > from. Holds vencidos fuera.
  const { data, error } = await supabase
    .from("blocks")
    .select("habitacion, checkin, checkout, status, expires_at")
    .eq("hotel_id", ctx.hotelId)
    .lt("checkin", to)
    .gt("checkout", from)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

  if (error) {
    console.error("GET disponibilidad error:", error.message);
    return NextResponse.json({});
  }

  const result: Record<string, Record<string, string>> = {};
  for (const b of (data ?? []) as BlockRow[]) {
    const status = (b.status || "").toUpperCase().trim();
    if (!SHOWN_STATUSES.has(status)) continue;
    const room = b.habitacion;
    const roomMap = (result[room] ??= {});
    for (const date of dateRange(b.checkin, b.checkout)) {
      if (date < from || date >= to) continue;
      const prev = roomMap[date];
      // Gana el estado de mayor prioridad si dos bloques coinciden en la celda.
      if (!prev || (PRIORITY[status] ?? 0) > (PRIORITY[prev] ?? 0)) {
        roomMap[date] = status;
      }
    }
  }

  return NextResponse.json(result);
  });
}

// POST { room, date } — bloquea manualmente UNA fecha (1 noche → [date, date+1)).
export async function POST(req: NextRequest) {
  return rutaSegura("admin.disponibilidad.post", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  const cuerpo = CUARTO_FECHA.safeParse(await req.json());
  if (!cuerpo.success) {
    return NextResponse.json({ error: "room y date (YYYY-MM-DD) requeridos" }, { status: 400 });
  }
  const { room, date } = cuerpo.data;
  await blockDates(ctx.hotelId, [room], date, addDays(date, 1), "BLOQUEADO");
  return NextResponse.json({ ok: true });
  });
}

// DELETE { room, date } — desbloquea UNA fecha bloqueada manualmente.
// Solo borra bloques BLOQUEADO/MANTENIMIENTO que cubran esa noche; NUNCA toca
// RESERVADO ni OTA (esas se cancelan desde Reservas / Canales).
export async function DELETE(req: NextRequest) {
  return rutaSegura("admin.disponibilidad.delete", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  const cuerpo = CUARTO_FECHA.safeParse(await req.json());
  if (!cuerpo.success) {
    return NextResponse.json({ error: "room y date (YYYY-MM-DD) requeridos" }, { status: 400 });
  }
  const { room, date } = cuerpo.data;

  const supabase = createAdminClient();
  const dayEnd = addDays(date, 1);

  // Bloques manuales del cuarto que cubren esa noche: checkin <= date AND checkout > date.
  const { data, error } = await supabase
    .from("blocks")
    .select("id, checkin, checkout, status")
    .eq("hotel_id", ctx.hotelId)
    .eq("habitacion", room)
    .in("status", ["BLOQUEADO", "MANTENIMIENTO"])
    .lte("checkin", date)
    .gt("checkout", date);

  if (error) {
    console.error("DELETE disponibilidad (select) error:", error.message);
    return NextResponse.json({ error: "Error al consultar bloqueos" }, { status: 500 });
  }

  const rows = (data ?? []) as { id: string; checkin: string; checkout: string; status: string }[];
  if (rows.length === 0) {
    return NextResponse.json(
      {
        error:
          "Solo se pueden desbloquear fechas bloqueadas manualmente. Las reservas se cancelan desde Reservas y los bloqueos OTA desde Canales.",
      },
      { status: 409 },
    );
  }

  // Para cada bloque que cubre esta noche: si es exactamente 1 noche, se borra;
  // si abarca más noches, se recorta para que la noche `date` quede libre y el
  // resto siga bloqueado (se borra y se reinsertan los tramos anterior/posterior).
  for (const r of rows) {
    const { error: delErr } = await supabase
      .from("blocks")
      .delete()
      .eq("hotel_id", ctx.hotelId)
      .eq("id", r.id);
    if (delErr) {
      console.error("DELETE disponibilidad (delete) error:", delErr.message);
      return NextResponse.json({ error: "Error al desbloquear" }, { status: 500 });
    }

    const status = r.status === "MANTENIMIENTO" ? "MANTENIMIENTO" : "BLOQUEADO";
    // Tramo anterior [checkin, date) y tramo posterior [date+1, checkout).
    if (r.checkin < date) {
      await blockDates(ctx.hotelId, [room], r.checkin, date, status as "BLOQUEADO" | "MANTENIMIENTO");
    }
    if (r.checkout > dayEnd) {
      await blockDates(ctx.hotelId, [room], dayEnd, r.checkout, status as "BLOQUEADO" | "MANTENIMIENTO");
    }
  }

  return NextResponse.json({ ok: true });
  });
}
