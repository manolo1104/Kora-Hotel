import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getBotStatus, setBotStatus } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getActiveHotel();
  // Igual que el POST: sin sesión/hotel activo no hay estado que reportar.
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const enabled = await getBotStatus(ctx.hotelId);
  return NextResponse.json({ enabled });
}

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const { enabled } = await req.json();
  await setBotStatus(ctx.hotelId, Boolean(enabled));
  return NextResponse.json({ ok: true });
}
