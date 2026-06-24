import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getGuestNotes, saveGuestNote } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

// GET → todas las notas del hotel activo, mapa { email(lowercase): notas }.
export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const notas = await getGuestNotes(ctx.hotelId);
  return NextResponse.json(notas);
}

// POST { email, notas } → upsert de la nota del huésped.
export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const { email, notas } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "email requerido" }, { status: 400 });
  }
  await saveGuestNote(ctx.hotelId, email, typeof notas === "string" ? notas : "");
  return NextResponse.json({ ok: true });
}
