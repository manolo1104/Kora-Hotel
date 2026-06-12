import { NextResponse } from "next/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { enviarEmail, NOTIFY_EMAIL } from "@/lib/email/resend";
import { emailLeadNuevo } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Endpoint PÚBLICO de captura de leads: los formularios del sitio (contacto y
// herramientas) insertan aquí directo al CRM y avisan al fundador al instante.
// Defensas: honeypot (_gotcha), rate limit por IP y validación mínima.

const VENTANA_MS = 60_000;
const MAX_POR_VENTANA = 5;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const ahora = Date.now();
  const previos = (hits.get(ip) || []).filter((t) => ahora - t < VENTANA_MS);
  previos.push(ahora);
  hits.set(ip, previos);
  return previos.length > MAX_POR_VENTANA;
}

const FORMSPREE_URL = process.env.NEXT_PUBLIC_FORMSPREE_URL ?? "";

const str = (v: unknown, max = 300): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

// Campos estándar; lo demás (resultados de calculadoras, etc.) va a notas.
const CAMPOS_BASE = new Set(["name", "whatsapp", "hotel", "herramienta", "rooms", "location", "_gotcha"]);

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Vas muy rápido. Espera un minuto e inténtalo de nuevo." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  // Honeypot: a los bots les respondemos éxito falso para que no reintenten.
  if (str(body._gotcha)) return NextResponse.json({ ok: true });

  const name = str(body.name, 120);
  const whatsapp = str(body.whatsapp, 30);
  const hotel = str(body.hotel, 160);
  const herramienta = str(body.herramienta, 80);
  const rooms = str(body.rooms, 20);
  const location = str(body.location, 160);

  if (!name || !whatsapp) {
    return NextResponse.json(
      { error: "Tu nombre y WhatsApp son obligatorios." },
      { status: 400 }
    );
  }

  const origen = herramienta ? `herramienta:${herramienta}` : "web-contacto";

  // Campos extra (resultados calculados, etc.) → notas legibles.
  const extras = Object.entries(body)
    .filter(([k, v]) => !CAMPOS_BASE.has(k) && typeof v === "string" && v.trim())
    .map(([k, v]) => `${k}: ${str(v, 200)}`);
  const notasPartes = [
    rooms ? `Habitaciones: ${rooms}` : "",
    location ? `Ubicación: ${location}` : "",
    ...extras,
  ].filter(Boolean);
  const notas = notasPartes.join("\n") || null;

  // Sin base de datos configurada (ej. falta la env en Vercel): el lead NO se
  // pierde — se reenvía a Formspree como antes y se responde éxito.
  if (!adminEnvReady) {
    if (FORMSPREE_URL) {
      const fd = new FormData();
      for (const [k, v] of Object.entries(body)) {
        if (typeof v === "string" && k !== "_gotcha") fd.append(k, v);
      }
      try {
        const res = await fetch(FORMSPREE_URL, {
          method: "POST",
          body: fd,
          headers: { Accept: "application/json" },
        });
        if (res.ok) return NextResponse.json({ ok: true });
      } catch {
        // cae al error de abajo
      }
    }
    return NextResponse.json(
      { error: "No pudimos registrar tu solicitud. Escríbenos por WhatsApp." },
      { status: 503 }
    );
  }

  const admin = createAdminClient();
  const { data: lead, error } = await admin
    .from("crm_leads")
    .insert({
      hotel_nombre: hotel || `(sin hotel) — ${name}`,
      tomador_nombre: name,
      contacto: whatsapp,
      ciudad: location || null,
      origen,
      etapa: "nuevo",
      notas,
    })
    .select("id")
    .single();

  if (error || !lead) {
    console.error("Error insertando lead:", error);
    return NextResponse.json(
      { error: "No pudimos registrar tu solicitud. Inténtalo de nuevo." },
      { status: 500 }
    );
  }

  // Actividad automática en el timeline del lead.
  await admin.from("crm_actividades").insert({
    lead_id: lead.id,
    tipo: "nota",
    nota: `Lead entró solo desde ${herramienta ? `la herramienta "${herramienta}"` : "el formulario de contacto"}.`,
  });

  // Aviso instantáneo al fundador (best-effort: el lead ya quedó guardado).
  if (NOTIFY_EMAIL) {
    enviarEmail({
      to: NOTIFY_EMAIL,
      ...emailLeadNuevo({
        nombre: name,
        whatsapp,
        hotel: hotel || undefined,
        origen,
        detalles: notas ?? undefined,
      }),
    }).catch(() => {});
  }

  // Respaldo temporal a Formspree mientras se confirma el flujo nuevo.
  if (FORMSPREE_URL) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(body)) {
      if (typeof v === "string" && k !== "_gotcha") fd.append(k, v);
    }
    fetch(FORMSPREE_URL, {
      method: "POST",
      body: fd,
      headers: { Accept: "application/json" },
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
