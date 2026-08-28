// Cron GLOBAL de sincronización iCal (multi-hotel). Portado de
// mi-hotel/app/api/cron/ical-sync (que era de un solo hotel) y generalizado a
// TODA la plataforma Kora:
//
//  - Protegido por Authorization: Bearer CRON_SECRET.
//  - Lista TODOS los ota_channels activos de TODOS los hoteles directamente con
//    createAdminClient (no pasa por getActiveHotel: no hay sesión en un cron).
//  - Por cada canal: fetch del iCal de la OTA → parse de VEVENTs (parser propio,
//    SIN node-ical) → updateOTABlocks(hotel_id, roomName, platform, rangos) +
//    updateOTASyncResult(hotel_id, id, status, blocks).
//  - Los errores son POR CANAL: un iCal caído marca ese canal en 'error' y sigue
//    con el resto; nunca aborta la corrida completa.
//
// El botón "Sync ahora" del panel NO pega aquí: usa /api/admin/canales/sync,
// que va con la sesión del hotelero y acotado a SU hotel. (Este comentario decía
// lo contrario y nombraba un NEXT_PUBLIC_CRON_SECRET que no existe en ninguna
// parte; dejarlo escrito invita a que alguien publique el secreto de los crons
// en el navegador para "arreglar" el botón.)

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateOTASyncResult } from "@/lib/db/admin";
import { updateOTABlocks, limpiarHoldsVencidos } from "@/lib/db/availability";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── Minimal iCal parser (sin dependencias) ──────────────────────────────────

function parseIcalDate(val: string): string {
  // Acepta: 20260601 o 20260601T120000Z → 2026-06-01.
  const clean = val.split("T")[0].replace(/\D/g, "");
  if (clean.length >= 8) {
    return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
  }
  return "";
}

interface IcalEvent {
  start: string;
  end: string;
}

function parseIcal(text: string): IcalEvent[] {
  const events: IcalEvent[] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  let inEvent = false;
  let start = "";
  let end = "";

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "BEGIN:VEVENT") { inEvent = true; start = ""; end = ""; continue; }
    if (line === "END:VEVENT") {
      if (inEvent && start && end) events.push({ start, end });
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    if (line.startsWith("DTSTART")) {
      const val = line.split(":").slice(1).join(":");
      start = parseIcalDate(val);
    } else if (line.startsWith("DTEND")) {
      const val = line.split(":").slice(1).join(":");
      end = parseIcalDate(val);
    }
  }
  return events;
}

// ── Fila cruda de ota_channels (todos los hoteles) ──────────────────────────

interface OTAChannelGlobalRow {
  id: string;
  hotel_id: string;
  room_name: string | null;
  tipo: string | null;
  ical_url: string | null;
  active: boolean | null;
}

// ── Handler ─────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Barrido de apartados vencidos (K-265). La función existe en la base desde
  // la fase 1 y no la llamaba NADIE, así que los apartados muertos se
  // acumulaban para siempre. Va aquí y no en un cron propio a propósito: Vercel
  // Hobby sólo permite un puñado de crons y ya están todos ocupados. No corta
  // la corrida si falla — limpiar es higiene, sincronizar es el trabajo.
  const holdsBorrados = await limpiarHoldsVencidos();
  if (holdsBorrados) console.log(`[cron/ical-sync] apartados vencidos borrados: ${holdsBorrados}`);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ota_channels")
    .select("id, hotel_id, room_name, tipo, ical_url, active")
    .eq("active", true);

  if (error) {
    console.error("ical-sync list error:", error.message);
    return NextResponse.json({ error: "db-error" }, { status: 500 });
  }

  const channels = ((data ?? []) as OTAChannelGlobalRow[]).filter(
    (c) => c.ical_url && c.room_name,
  );

  const results: Array<{
    hotelId: string;
    id: string;
    roomName: string;
    platform: string;
    blocks: number;
    error?: string;
  }> = [];

  for (const ch of channels) {
    const roomName = ch.room_name as string;
    const platform = ch.tipo ?? "booking_com";
    try {
      const res = await fetch(ch.ical_url as string, {
        headers: { "User-Agent": "Kora-ChannelManager/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const text = await res.text();
      const events = parseIcal(text);

      const dateRanges = events
        .filter((e) => e.start && e.end)
        .map((e) => ({ checkin: e.start, checkout: e.end }));

      const blocked = await updateOTABlocks(ch.hotel_id, roomName, platform, dateRanges);
      await updateOTASyncResult(ch.hotel_id, ch.id, "ok", blocked);
      results.push({ hotelId: ch.hotel_id, id: ch.id, roomName, platform, blocks: blocked });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`iCal sync error [${ch.hotel_id}/${roomName}/${platform}]:`, message);
      await updateOTASyncResult(ch.hotel_id, ch.id, "error", 0);
      results.push({ hotelId: ch.hotel_id, id: ch.id, roomName, platform, blocks: 0, error: message });
    }
  }

  return NextResponse.json({
    synced: results.length,
    results,
    timestamp: new Date().toISOString(),
  });
}
