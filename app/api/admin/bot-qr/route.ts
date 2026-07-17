// Estado + QR del bot de WhatsApp de un hotel, para mostrarlo en el panel.
// El QR lo genera el runtime de Camila (whatsapp-web.js en Railway); aquí Kora
// hace de proxy: valida que quien pide sea miembro del hotel y consulta al
// runtime con el secreto de plataforma. Si el runtime no está configurado o no
// responde, degrada a "sin-servicio" (la UI muestra que el equipo Kora ayuda).

import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });

  const base = process.env.CAMILA_RUNTIME_URL;
  const secret = process.env.BOT_FLEET_SECRET;
  if (!base || !secret) {
    return NextResponse.json({ ok: true, status: "sin-servicio", qr: null });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/estado?slug=${encodeURIComponent(ctx.hotel.slug)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ ok: true, status: "sin-servicio", qr: null });
    }
    const d = (await res.json()) as { status?: string; qr?: string | null };
    return NextResponse.json({
      ok: true,
      status: typeof d.status === "string" ? d.status : "desconocido",
      qr: typeof d.qr === "string" ? d.qr : null,
    });
  } catch {
    // Timeout / runtime caído / red: no es un error del panel, solo no hay servicio.
    return NextResponse.json({ ok: true, status: "sin-servicio", qr: null });
  } finally {
    clearTimeout(timeout);
  }
}
