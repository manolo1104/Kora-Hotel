import { negar } from "@/lib/panel/permisos";
import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { getBotStatus, setBotStatus } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

// Conexión REAL de WhatsApp según el runtime de Camila (Railway), con caché en
// memoria de 45 s por hotel: el sidebar pide este estado en cada página del
// panel y no tiene caso pegarle al runtime cada vez. FIX de honestidad: antes
// el sidebar mostraba "Activo" solo por el flag on/off, aunque el WhatsApp
// nunca se hubiera vinculado.
const conexionCache = new Map<string, { at: number; estado: string }>();

async function conexionRuntime(slug: string): Promise<string> {
  const base = process.env.CAMILA_RUNTIME_URL;
  const secret = process.env.BOT_FLEET_SECRET;
  if (!base || !secret) return "sin-servicio";
  const hit = conexionCache.get(slug);
  if (hit && Date.now() - hit.at < 45_000) return hit.estado;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(
      `${base.replace(/\/$/, "")}/estado?slug=${encodeURIComponent(slug)}`,
      { headers: { Authorization: `Bearer ${secret}` }, signal: controller.signal, cache: "no-store" },
    );
    const estado = res.ok
      ? String(((await res.json()) as { status?: string }).status ?? "desconocido")
      : "sin-servicio";
    conexionCache.set(slug, { at: Date.now(), estado });
    return estado;
  } catch {
    // Timeout / runtime caído: no es error del panel, solo no hay conexión visible.
    return "sin-servicio";
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET() {
  const ctx = await getActiveHotel();
  // Igual que el POST: sin sesión/hotel activo no hay estado que reportar.
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "bot:leer");
  if (no) return no;
  const enabled = await getBotStatus(ctx.hotelId);
  const conexion = await conexionRuntime(ctx.hotel.slug);
  return NextResponse.json({ enabled, conexion });
}

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "bot:entrenar");
  if (no) return no;
  const { enabled } = await req.json();
  await setBotStatus(ctx.hotelId, Boolean(enabled));
  return NextResponse.json({ ok: true });
}
