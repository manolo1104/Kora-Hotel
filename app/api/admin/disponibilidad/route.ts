import { negar } from "@/lib/panel/permisos";
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
import { blockDates, recortarBloqueo } from "@/lib/db/availability";
import { unitNamesOf } from "@/lib/booking";

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

/** Noches entre dos fechas ISO, con el rango half-open del motor. */
function noches(desde: string, hasta: string): number {
  const a = new Date(`${desde}T00:00:00`).getTime();
  const b = new Date(`${hasta}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
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

// Cerrar una unidad. Acepta las DOS formas a propósito:
//
//   • `{ room, date }`            — una noche, como siempre. Es lo que manda el
//                                   clic suelto del calendario.
//   • `{ room, desde, hasta, … }` — un RANGO, que es la forma en que ocurre un
//                                   mantenimiento de verdad. Hasta el 2 sep 2026
//                                   sólo existía la primera: para cerrar una
//                                   cabaña diez días había que dar diez clics, y
//                                   por eso nadie lo usaba — cerraban la cabaña
//                                   inventando una RESERVA FALSA, que ensucia la
//                                   ocupación, el ADR y el CRM para siempre.
//
// `tipo` distingue "lo cierro yo porque quiero" de "está roto". Los dos cierran
// igual la venta; el segundo además es lo que la camarista y el de mantenimiento
// necesitan ver en el mapa de cuartos.
const TOPE_NOCHES = 365;
const BLOQUEO = z
  .object({
    room: z.string().min(1).max(200),
    date: FECHA.optional(),
    desde: FECHA.optional(),
    hasta: FECHA.optional(),
    tipo: z.enum(["manual", "mantenimiento"]).default("manual"),
    motivo: z.string().max(300).optional(),
  })
  .refine((b) => Boolean(b.date) || (Boolean(b.desde) && Boolean(b.hasta)), {
    message: "hace falta `date`, o `desde` y `hasta`",
  });

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (opcionales) — por defecto los próximos N meses.
// Devuelve Record<room, Record<dateISO, status>>.
export async function GET(req: NextRequest) {
  return rutaSegura("admin.disponibilidad.get", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "reservas:leer");
  if (no) return no;

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

// POST { room, date } | { room, desde, hasta, tipo?, motivo? }
// Cierra la venta de una unidad. Rango half-open [desde, hasta): la noche de
// `hasta` queda libre, igual que en todo el motor.
export async function POST(req: NextRequest) {
  return rutaSegura("admin.disponibilidad.post", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "calendario:escribir");
  if (no) return no;

  const cuerpo = BLOQUEO.safeParse(await req.json());
  if (!cuerpo.success) {
    return NextResponse.json(
      { error: "Falta la habitación y la fecha (o el rango desde/hasta), en formato YYYY-MM-DD." },
      { status: 400 },
    );
  }
  const { room, date, tipo, motivo } = cuerpo.data;
  const desde = cuerpo.data.desde ?? date!;
  const hasta = cuerpo.data.hasta ?? addDays(date!, 1);

  if (hasta <= desde) {
    return NextResponse.json(
      { error: "La fecha de fin tiene que ser posterior a la de inicio." },
      { status: 400 },
    );
  }
  // Un rango absurdo (un año y pico, casi siempre un año mal tecleado) cierra el
  // hotel entero sin que nadie lo note hasta que dejan de entrar reservas.
  if (noches(desde, hasta) > TOPE_NOCHES) {
    return NextResponse.json(
      { error: `No se pueden cerrar más de ${TOPE_NOCHES} noches de una vez.` },
      { status: 400 },
    );
  }
  // La unidad tiene que existir. Sin esto, un nombre mal escrito crea una fila
  // que no cierra nada y el hotelero se queda creyendo que su cuarto está fuera
  // de servicio — el peor de los dos fallos posibles, porque falla en silencio.
  if (!unitNamesOf(ctx.hotel).includes(room)) {
    return NextResponse.json(
      { error: "Esa habitación no existe en tu hotel." },
      { status: 400 },
    );
  }

  await blockDates(
    ctx.hotelId,
    [room],
    desde,
    hasta,
    tipo === "mantenimiento" ? "MANTENIMIENTO" : "BLOQUEADO",
    motivo,
  );
  return NextResponse.json({ ok: true, noches: noches(desde, hasta) });
  });
}

// DELETE { room, date } — desbloquea UNA fecha bloqueada manualmente.
// Solo borra bloques BLOQUEADO/MANTENIMIENTO que cubran esa noche; NUNCA toca
// RESERVADO ni OTA (esas se cancelan desde Reservas / Canales).
export async function DELETE(req: NextRequest) {
  return rutaSegura("admin.disponibilidad.delete", async () => {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "calendario:escribir");
  if (no) return no;

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

  // Para cada bloque que cubre esta noche: si es exactamente 1 noche
  // desaparece; si abarca más, se recorta para que sólo `date` quede libre.
  //
  // LO HACE LA BASE, EN UNA TRANSACCIÓN (K-80, K-179). Antes eran tres
  // escrituras sueltas desde aquí: borrar el bloqueo entero y después reponer
  // los tramos de antes y de después. Entre la primera y las otras, TODAS esas
  // noches quedaban vendibles; y si la reposición fallaba, el bloqueo que el
  // hotelero había puesto a propósito simplemente ya no existía.
  for (const r of rows) {
    const res = await recortarBloqueo(ctx.hotelId, r.id, date);
    if (res.ok) continue;

    if (!res.falta) {
      console.error("DELETE disponibilidad (recortar) error:", res.detalle);
      return NextResponse.json({ error: "Error al desbloquear" }, { status: 500 });
    }

    // La base todavía no tiene `recortar_bloqueo` (falta correr
    // sql/kora-e3-apartado-atomico.sql). Se hace como siempre —con su hueco—
    // pero queda dicho en el log, no disimulado.
    console.error(
      "[admin/disponibilidad] recortar_bloqueo no existe; desbloqueando por el " +
        "camino viejo (hay un instante en que esas noches quedan vendibles). " +
        "Falta correr sql/kora-e3-apartado-atomico.sql.",
    );
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
