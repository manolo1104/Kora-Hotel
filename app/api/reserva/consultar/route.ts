import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findGuestBooking, serializeGuestBooking } from "@/lib/db/portal";

export const dynamic = "force-dynamic";

const Body = z.object({
  folio: z.string().trim().min(4).max(20),
  email: z.email().max(160),
});

// Portal del huésped: consulta de reserva con folio + email. Mensaje de error
// único (no revela si el folio existe con otro correo).
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "datos-invalidos" }, { status: 400 });

  const booking = await findGuestBooking(parsed.data.folio, parsed.data.email);
  if (!booking) return NextResponse.json({ error: "no-encontrada" }, { status: 404 });

  return NextResponse.json({ booking: serializeGuestBooking(booking) });
}
