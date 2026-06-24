import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getAllBookings } from "@/lib/db/admin";
import { calcKPIs } from "@/lib/admin/kpis";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const bookings = await getAllBookings(ctx.hotelId);
  const kpis = calcKPIs(bookings);
  return NextResponse.json(kpis);
}
