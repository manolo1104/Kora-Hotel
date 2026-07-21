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
import { randomUUID } from "node:crypto";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { accesoDelHotel } from "@/lib/suscripcion";
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
    return NextResponse.json({ ok: false, error: error.message, hotels: [] }, { status: 500 });
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

  for (const h of rows) {
    const cfg = (h.config ?? {}) as Record<string, unknown>;
    const extras = (h.extras ?? {}) as Record<string, unknown>;
    let token = typeof cfg.agent_token === "string" ? cfg.agent_token : "";

    // Filtros: hotel publicado, no demo, y el dueño no lo apagó.
    if (!h.publicado) continue;
    if (extras.demo === true) continue;
    if (cfg.bot_enabled === false) continue;

    // Sin acceso (plan vencido y prueba terminada) → no gastamos WhatsApp+IA.
    const acceso = await accesoDelHotel(h);
    if (!acceso.activo) continue;

    // FIX de acceso: antes el token solo se generaba si el dueño abría "Ver
    // token (avanzado)" en el panel — un hotel en prueba gratis que nunca
    // tocaba eso quedaba FUERA del fleet y jamás veía su QR. Ahora todo hotel
    // elegible (publicado + acceso activo, incluida la prueba) recibe su token
    // aquí mismo y su Camila arranca sola.
    if (!token) {
      token = `kora_${randomUUID().replace(/-/g, "")}`;
      const { error: tokErr } = await admin
        .from("hoteles")
        .update({ config: { ...cfg, agent_token: token } })
        .eq("id", h.id);
      if (tokErr) {
        console.error(`[bots/fleet] no pude generar token para ${h.slug}:`, tokErr.message);
        continue; // sin token persistido no puede hablar con /api/agent
      }
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

  return NextResponse.json({ ok: true, hotels });
}
