// Sincronización iCal MANUAL desde el panel ("Sync ahora"), AUTENTICADA y
// acotada al hotel activo (getActiveHotel). A diferencia del cron global
// (/api/cron/ical-sync, protegido por CRON_SECRET), aquí NO se usa ningún secreto
// en el navegador: la sesión + la cookie del hotel garantizan que cada quien solo
// sincroniza SU hotel.

import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateOTASyncResult } from "@/lib/db/admin";
import { updateOTABlocks } from "@/lib/db/availability";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function parseIcalDate(val: string): string {
  const clean = val.split("T")[0].replace(/\D/g, "");
  return clean.length >= 8 ? `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}` : "";
}

function parseIcal(text: string): { start: string; end: string }[] {
  const events: { start: string; end: string }[] = [];
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
    if (line.startsWith("DTSTART")) start = parseIcalDate(line.split(":").slice(1).join(":"));
    else if (line.startsWith("DTEND")) end = parseIcalDate(line.split(":").slice(1).join(":"));
  }
  return events;
}

interface ChannelRow {
  id: string;
  room_name: string | null;
  tipo: string | null;
  ical_url: string | null;
}

export async function POST() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ota_channels")
    .select("id, room_name, tipo, ical_url")
    .eq("hotel_id", ctx.hotelId)
    .eq("active", true);
  if (error) return NextResponse.json({ error: "db-error" }, { status: 500 });

  const channels = ((data ?? []) as ChannelRow[]).filter((c) => c.ical_url && c.room_name);
  let synced = 0;
  let blocks = 0;

  for (const ch of channels) {
    const roomName = ch.room_name as string;
    const platform = ch.tipo ?? "booking_com";
    try {
      const res = await fetch(ch.ical_url as string, {
        headers: { "User-Agent": "Kora-ChannelManager/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const events = parseIcal(await res.text());
      const ranges = events
        .filter((e) => e.start && e.end)
        .map((e) => ({ checkin: e.start, checkout: e.end }));
      const blocked = await updateOTABlocks(ctx.hotelId, roomName, platform, ranges);
      await updateOTASyncResult(ctx.hotelId, ch.id, "ok", blocked);
      synced++;
      blocks += blocked;
    } catch (e) {
      await updateOTASyncResult(ctx.hotelId, ch.id, "error", 0);
      console.error("canales/sync error:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ synced, blocks, total: channels.length });
}
