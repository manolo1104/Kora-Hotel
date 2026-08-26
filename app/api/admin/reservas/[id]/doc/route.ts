import { negar } from "@/lib/panel/permisos";
// Guarda los overrides del documento de una RESERVA (editor "modificar antes de
// descargar") en la columna doc. Auth por getActiveHotel(). El id es la
// confirmación (folio).

import { NextRequest, NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { saveBookingDoc } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "reservas:escribir");
  if (no) return no;

  const { id } = await params; // confirmación (folio)
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  const raw =
    body && typeof body === "object" && "doc" in body
      ? (body as { doc: unknown }).doc
      : body;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  const doc = raw as Record<string, unknown>;
  if (JSON.stringify(doc).length > 40000) {
    return NextResponse.json({ error: "too-large" }, { status: 413 });
  }

  const res = await saveBookingDoc(ctx.hotelId, id, doc);
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: res.error, hint: "¿Corriste sql/kora-documentos.sql en Supabase?" },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
