import { NextResponse } from "next/server";
import { escribir, escribirMejorEsfuerzo } from "@/lib/db/result";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { enviarEmail, NOTIFY_EMAIL } from "@/lib/email/resend";
import { emailLeadNuevo, emailLeadDay0 } from "@/lib/email/templates";

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
const CAMPOS_BASE = new Set([
  "name",
  "whatsapp",
  "email",
  "hotel",
  "herramienta",
  "rooms",
  "location",
  "_gotcha",
]);

/** Fecha (YYYY-MM-DD) a N días de hoy, en zona MX. */
function enDias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

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
  const emailLead = str(body.email, 160).toLowerCase();
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

  // `proximo_seguimiento` se pone SOLO: antes quedaba en NULL y la sección
  // "seguimientos vencidos" del digest nunca se disparaba, así que un lead sin
  // contactar desaparecía del radar a las 24 h.
  const filaLead: Record<string, unknown> = {
    hotel_nombre: hotel || `(sin hotel) — ${name}`,
    tomador_nombre: name,
    contacto: whatsapp,
    ciudad: location || null,
    origen,
    etapa: "nuevo",
    notas,
    proximo_seguimiento: enDias(2),
  };
  if (emailLead.includes("@")) filaLead.email = emailLead;

  let { data: lead, error } = await admin
    .from("crm_leads")
    .insert(filaLead)
    .select("id")
    .single();

  // Si la columna `email` (o `proximo_seguimiento`) todavía no existe en la BD,
  // se reintenta sin ellas: perder el lead sería mucho peor que perder el dato.
  if (error && /column .* does not exist|schema cache/i.test(error.message)) {
    console.error("crm_leads sin columnas nuevas, reintentando:", error.message);
    delete filaLead.email;
    delete filaLead.proximo_seguimiento;
    ({ data: lead, error } = await admin
      .from("crm_leads")
      .insert(filaLead)
      .select("id")
      .single());
  }

  if (error || !lead) {
    console.error("Error insertando lead:", error);
    return NextResponse.json(
      { error: "No pudimos registrar tu solicitud. Inténtalo de nuevo." },
      { status: 500 }
    );
  }

  // Actividad automática en el timeline del lead. Mejor-esfuerzo declarado: el
  // lead ya está guardado y perder una línea del timeline no cuesta un cliente.
  await escribirMejorEsfuerzo(
    "crm_actividades.leadNuevo",
    admin.from("crm_actividades").insert({
      lead_id: lead.id,
      tipo: "nota",
      nota: `Lead entró solo desde ${herramienta ? `la herramienta "${herramienta}"` : "el formulario de contacto"}.`,
    }),
  );

  // Aviso instantáneo al fundador (best-effort: el lead ya quedó guardado).
  if (NOTIFY_EMAIL) {
    // CON await: sin él Vercel corta el envío al responder (ver crear-hotel).
    await enviarEmail({
      to: NOTIFY_EMAIL,
      ...emailLeadNuevo({
        nombre: name,
        whatsapp,
        email: emailLead || undefined,
        hotel: hotel || undefined,
        origen,
        detalles: notas ?? undefined,
      }),
    }).catch((e) => console.error("[leads] ignorado:", e));
  }

  // Primer toque de la secuencia AL LEAD, en el momento: acusa recibo, aterriza
  // qué es Kora y avisa que Manolo le escribe. Los toques de los días 3 y 7 los
  // manda /api/cron/leads. Best-effort y con su marca en lead_email_log para que
  // el cron no lo repita.
  //
  // CON await, igual que el aviso al fundador de aquí arriba: iba dentro de un
  // `void (async () => …)()`, que es exactamente el patrón que el comentario de
  // tres líneas más arriba documenta como la causa de los correos perdidos en
  // Vercel. La función responde y se apaga antes de que el envío termine, así
  // que el primer toque de la secuencia se perdía a veces — y peor: la marca en
  // `lead_email_log` sí quedaba escrita, así que el cron lo daba por enviado y
  // nunca lo reintentaba. El lead se quedaba sin su primer correo, para siempre.
  if (emailLead.includes("@")) {
    try {
      await escribir(
        "lead_email_log.day0",
        admin
          .from("lead_email_log")
          .upsert(
            { lead_id: lead.id, email_type: "lead_day0", email_destino: emailLead },
            { onConflict: "lead_id,email_type", ignoreDuplicates: true },
          ),
      );
      const envio = await enviarEmail({
        to: emailLead,
        ...emailLeadDay0({ nombre: name, hotel: hotel || undefined }),
      });
      // La marca se escribe ANTES para que dos peticiones a la vez no manden dos
      // correos. Pero si el envío falla hay que retirarla: si no, el cron ve el
      // toque como enviado y el lead se queda sin su primer correo para siempre.
      if (!envio.ok) {
        await escribirMejorEsfuerzo(
          "lead_email_log.day0.liberar",
          admin.from("lead_email_log").delete().eq("lead_id", lead.id).eq("email_type", "lead_day0"),
        );
        console.error("primer correo al lead falló:", envio.error);
      }
    } catch (e) {
      console.error("primer correo al lead falló:", e);
    }
  }

  // Respaldo temporal a Formspree mientras se confirma el flujo nuevo.
  if (FORMSPREE_URL) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(body)) {
      if (typeof v === "string" && k !== "_gotcha") fd.append(k, v);
    }
    // CON await, por lo mismo: es la única ruta de esta función que lanzaba una
    // petición sin esperarla, y en Vercel eso se pierde al responder. Con tope de
    // 3 s: esperar sin límite a un respaldo convierte su caída en la caída del
    // alta de leads, que es el camino comercial más caro que tiene Kora.
    const corte = AbortSignal.timeout(3000);
    await fetch(FORMSPREE_URL, {
      method: "POST",
      body: fd,
      headers: { Accept: "application/json" },
      signal: corte,
    }).catch((e) => console.error("[leads] respaldo Formspree falló:", e));
  }

  return NextResponse.json({ ok: true });
}
