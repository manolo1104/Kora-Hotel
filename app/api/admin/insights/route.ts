import { negar } from "@/lib/panel/permisos";
import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getAllBookings, getAgentMetrics } from "@/lib/db/admin";
import { calcInsights } from "@/lib/admin/insights";
import { totalUnits } from "@/lib/booking";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "ia:usar");
  if (no) return no;
  const [bookings, agentMetrics] = await Promise.all([
    getAllBookings(ctx.hotelId),
    getAgentMetrics(ctx.hotelId),
  ]);
  const totalCuartos = totalUnits(ctx.hotel) || 13;
  const data = calcInsights(bookings, agentMetrics, totalCuartos);
  return NextResponse.json(data);
}
