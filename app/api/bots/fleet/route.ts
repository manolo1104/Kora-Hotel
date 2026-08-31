// Fleet del bot WhatsApp (Camila). El runtime multi-tenant (agentes/camila,
// whatsapp-web.js en Railway) consulta aquí, con un SECRETO DE PLATAFORMA, la
// lista de hoteles que deben tener Camila corriendo: cada uno con su token del
// bot (config.agent_token) y su número de WhatsApp. Con ese token el runtime
// habla con /api/agent (conocimiento, disponibilidad, reservar) por hotel.
//
// Auth: Authorization: Bearer $BOT_FLEET_SECRET (mismo patrón que el cron).
// El token de cada hotel es un SECRETO — por eso esto NO es público: solo el
// runtime, con el secreto de plataforma, obtiene la lista de tokens.
//
// Regla de negocio: solo hoteles publicados, no-demo, con token generado y con
// ACCESO ACTIVO (plan pagado o prueba vigente). Sin plan → sin Camila.

import { NextResponse } from "next/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { accesoDelHotel } from "@/lib/suscripcion";
import { asegurarBotToken } from "@/lib/db/bot-token";
import { motivosSinBot } from "@/lib/bot/elegibilidad";
import { alertar } from "@/lib/alertas";
import type { HotelRow } from "@/lib/tenant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.BOT_FLEET_SECRET ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!adminEnvReady) {
    return NextResponse.json({ ok: false, motivo: "Sin BD.", hotels: [] });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("hoteles")
    .select("id, owner_id, slug, nombre, whatsapp, publicado, created_at, config, extras");
  if (error) {
    console.error("[bots/fleet] error leyendo hoteles:", error.message);
    console.error("[bots.fleet]", error.message);
    return NextResponse.json({ ok: false, error: "No se pudo completar la operación. Intenta de nuevo.", hotels: [] }, { status: 500 });
  }

  const rows = (data ?? []) as HotelRow[];
  const hotels: {
    id: string;
    slug: string;
    nombre: string;
    token: string;
    whatsapp: string | null;
    lang: "es" | "en";
  }[] = [];
  const fallos: string[] = [];

  for (const h of rows) {
    const cfg = (h.config ?? {}) as Record<string, unknown>;

    // Los requisitos viven en lib/bot/elegibilidad.ts, compartidos con el panel:
    // así la pantalla de Camila puede decirle al hotelero EXACTAMENTE qué le
    // falta en vez de dejarlo esperando un QR que nunca iba a llegar.
    // (El de WhatsApp no bloquea el fleet: un hotel puede tener Camila lista y
    // poner el número después; sólo se le avisa en el panel.)
    const acceso = await accesoDelHotel(h);
    const motivos = motivosSinBot(h, acceso.activo).filter((m) => m !== "sin-whatsapp");
    if (motivos.length > 0) continue;

    // FIX de acceso: antes el token solo se generaba si el dueño abría "Ver
    // token (avanzado)" en el panel — un hotel en prueba gratis que nunca
    // tocaba eso quedaba FUERA del fleet y jamás veía su QR. Ahora todo hotel
    // elegible (publicado + acceso activo, incluida la prueba) recibe su token
    // aquí mismo y su Camila arranca sola.
    // El token sale de `hotel_bot_tokens` (sólo service-role), no de `config`,
    // que se puede leer desde internet con la llave anónima del navegador.
    // Un hotel que falle NO puede tumbar al resto: se salta y se avisa. Pero si
    // al final no salió NINGUNO y hubo fallos, la ruta responde 500 (abajo), y el
    // runtime conserva los bots que ya tiene corriendo en vez de apagarlos todos.
    let token: string;
    try {
      token = await asegurarBotToken(h.id);
    } catch (e) {
      fallos.push(`${h.slug}: ${e instanceof Error ? e.message : String(e)}`);
      continue; // sin token persistido no puede hablar con /api/agent
    }

    hotels.push({
      id: h.id,
      slug: h.slug,
      nombre: h.nombre,
      token,
      whatsapp: h.whatsapp,
      lang: cfg.bot_lang === "en" ? "en" : "es",
    });
  }

  if (fallos.length) {
    await alertar(
      "hoteles sin token de bot en el fleet",
      `No se pudo obtener/generar el token de ${fallos.length} hotel(es):\n${fallos.join("\n")}`,
    );
    // Ninguno salió y todos fallaron: es un fallo de la tabla, no de los hoteles.
    // 500 hace que el runtime CONSERVE los bots vivos (ver agentes/camila/fleet.js).
    if (!hotels.length) {
      return NextResponse.json({ error: "fleet-ilegible" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, hotels });
}
