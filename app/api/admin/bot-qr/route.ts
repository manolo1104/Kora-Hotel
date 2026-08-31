import { negar } from "@/lib/panel/permisos";
// Estado + QR del bot de WhatsApp de un hotel, para mostrarlo en el panel.
// El QR lo genera el runtime de Camila (whatsapp-web.js en Railway); aquí Kora
// hace de proxy: valida que quien pide sea miembro del hotel y consulta al
// runtime con el secreto de plataforma. Si el runtime no está configurado o no
// responde, degrada a "sin-servicio" (la UI muestra que el equipo Kora ayuda).

import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { accesoDelHotel } from "@/lib/suscripcion";
import { motivosSinBot, QUE_HACER } from "@/lib/bot/elegibilidad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  // El QR no es una foto informativa: escanearlo VINCULA UN DISPOSITIVO a la
  // cuenta de WhatsApp del hotel, de forma permanente y sin aviso. Quien lo
  // escanee lee cada conversación con cada huésped (nombres, teléfonos, fechas,
  // links de pago) y puede escribir haciéndose pasar por el hotel. Antes bastaba
  // ser miembro, así que un rol `limpieza` podía pedirlo. Es la misma acción de
  // alto privilegio que generar el token del bot, que sí exigía `dueno`.
  const noPuede = negar(ctx, "bot:vincular");
  if (noPuede) return noPuede;
  console.warn(`[bot-qr] QR de vinculación solicitado por ${ctx.userId} en ${ctx.hotel.slug}`);

  // ANTES DE PREGUNTARLE AL RUNTIME: ¿este hotel es siquiera elegible?
  //
  // Si no lo es, el runtime nunca va a levantar su Camila y el panel se quedaba
  // diciendo «Estamos preparando tu conexión» para siempre — pidiéndole esperar
  // por algo que dependía de él. Los motivos salen de la MISMA lista que aplica
  // /api/bots/fleet, así que el panel no puede contradecir al fleet.
  const acceso = await accesoDelHotel(ctx.hotel);
  const motivos = motivosSinBot(ctx.hotel, acceso.activo);
  if (motivos.length > 0) {
    return NextResponse.json({
      ok: true,
      status: "requisitos",
      qr: null,
      motivos: motivos.map((m) => ({ clave: m, ...QUE_HACER[m] })),
    });
  }

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
    const d = (await res.json()) as { status?: string; qr?: string | null; err?: string };
    return NextResponse.json({
      ok: true,
      status: typeof d.status === "string" ? d.status : "desconocido",
      qr: typeof d.qr === "string" ? d.qr : null,
      // El motivo técnico del fallo, para el aviso interno. No se le enseña al
      // hotelero: a él se le dice qué hacer, no qué excepción lanzó Chromium.
      err: typeof d.err === "string" ? d.err : undefined,
    });
  } catch {
    // Timeout / runtime caído / red: no es un error del panel, solo no hay servicio.
    return NextResponse.json({ ok: true, status: "sin-servicio", qr: null });
  } finally {
    clearTimeout(timeout);
  }
}
