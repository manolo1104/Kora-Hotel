// Marca que el hotelero ya vio (o saltó) el tour guiado del panel. Se guarda en
// extras.onboarding.tourVisto con MERGE, para no pisar otras claves del jsonb.

import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  const extras = (ctx.hotel.extras ?? {}) as Record<string, unknown>;
  const onboarding = (extras.onboarding ?? {}) as Record<string, unknown>;
  const nuevos = { ...extras, onboarding: { ...onboarding, tourVisto: true } };

  const admin = createAdminClient();
  const { error } = await admin.from("hoteles").update({ extras: nuevos }).eq("id", ctx.hotelId);
  if (error) return NextResponse.json({ error: "db" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
