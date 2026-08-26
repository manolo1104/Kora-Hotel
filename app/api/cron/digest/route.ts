import { alertar } from "@/lib/alertas";
import { NextResponse } from "next/server";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { enviarEmail, NOTIFY_EMAIL } from "@/lib/email/resend";
import { emailDigest } from "@/lib/email/templates";
import { PLANES } from "@/lib/oferta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Digest diario para el fundador (cron de Vercel, ver vercel.json).
// Junta lo que requiere su atención: leads nuevos, seguimientos vencidos,
// pagos con problema y chats escalados. Si no hay nada, no manda correo.

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function autorizado(req: Request): boolean {
  const secreto = process.env.CRON_SECRET ?? "";
  if (!secreto) return false;
  return req.headers.get("authorization") === `Bearer ${secreto}`;
}

function linkWa(contacto: string | null, nombre: string | null): string {
  const digitos = (contacto ?? "").replace(/\D/g, "");
  if (!digitos) return "";
  const numero = digitos.length === 10 ? `52${digitos}` : digitos;
  const txt = encodeURIComponent(`Hola ${nombre ?? ""}, soy Manolo de Kora 👋`.trim());
  return ` — <a href="https://wa.me/${numero}?text=${txt}">WhatsApp</a>`;
}

export async function GET(req: Request) {
  if (!autorizado(req)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  if (!adminEnvReady || !NOTIFY_EMAIL) {
    return NextResponse.json({ ok: false, motivo: "Sin BD o sin NOTIFY_EMAIL." });
  }

  const admin = createAdminClient();
  const hace24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const hoy = new Date().toISOString().slice(0, 10);

  const [leadsNuevos, seguimientos, vencidos, escalados, activas] = await Promise.all([
    // TODOS los leads que siguen en "nuevo", no solo los de las últimas 24 h.
    // Antes se filtraba por `created_at >= hace24h`: un lead que no contestabas
    // hoy desaparecía del resumen mañana y ya nadie lo volvía a recordar.
    admin
      .from("crm_leads")
      .select("hotel_nombre, tomador_nombre, contacto, origen, created_at")
      .eq("etapa", "nuevo")
      .order("created_at", { ascending: true })
      .limit(40),
    admin
      .from("crm_leads")
      .select("hotel_nombre, tomador_nombre, contacto, etapa, proximo_seguimiento")
      .lte("proximo_seguimiento", hoy)
      .not("etapa", "in", '("ganado","perdido")')
      .order("proximo_seguimiento", { ascending: true })
      .limit(20),
    admin
      .from("suscripciones")
      .select("user_id, plan, avisos_dunning")
      .eq("estado", "pago_vencido"),
    admin
      .from("soporte_conversaciones")
      .select("pagina, mensajes")
      .eq("escalado", true)
      .gte("updated_at", hace24h)
      .limit(10),
    admin.from("suscripciones").select("plan").in("estado", ["activa", "cortesia"]),
  ]);

  const secciones: { encabezado: string; lineas: string[] }[] = [];

  // El silencio y el cero tienen que verse distintos. Antes cada sección se
  // comprobaba sólo con `.data?.length`, así que una consulta rota era
  // indistinguible de "no hay nada" y el resumen —el mecanismo entero de que
  // nada se pierda— omitía la sección sin decirlo. Un lead sin contactar
  // desaparecía del correo y nadie se enteraba nunca.
  const rotas: string[] = [];
  for (const [nombre, r] of [
    ["leads nuevos", leadsNuevos],
    ["seguimientos de hoy", seguimientos],
    ["pagos vencidos", vencidos],
    ["chats escalados", escalados],
    ["suscripciones activas", activas],
  ] as const) {
    if (r.error) {
      console.error(`[cron/digest] no se pudo leer ${nombre}:`, r.error.message);
      rotas.push(nombre);
    }
  }
  if (rotas.length) {
    secciones.push({
      encabezado: "⚠️ Datos que no se pudieron leer",
      lineas: rotas.map((n) => `⚠️ No se pudo leer ${n}`),
    });
  }

  if (leadsNuevos.data?.length) {
    // Los más viejos primero y con los días que llevan esperando: un lead de 5
    // días sin contactar debe verse peor que uno de hoy.
    const dias = (iso: string | null) =>
      iso ? Math.floor((Date.now() - Date.parse(iso)) / 86_400_000) : 0;
    secciones.push({
      encabezado: `🆕 Leads sin contactar (${leadsNuevos.data.length})`,
      lineas: leadsNuevos.data.map((l) => {
        const d = dias(l.created_at as string | null);
        const espera =
          d === 0 ? "hoy" : d === 1 ? "<b>lleva 1 día</b>" : `<b>lleva ${d} días</b>`;
        return `<b>${esc(l.hotel_nombre)}</b> (${esc(l.tomador_nombre ?? "?")}, vía ${esc(l.origen ?? "?")}) — ${espera}${linkWa(l.contacto, l.tomador_nombre)}`;
      }),
    });
  }

  if (seguimientos.data?.length) {
    secciones.push({
      encabezado: `📅 Seguimientos vencidos (${seguimientos.data.length})`,
      lineas: seguimientos.data.map(
        (l) =>
          `<b>${esc(l.hotel_nombre)}</b> — etapa ${esc(l.etapa)}, tocaba el ${l.proximo_seguimiento}${linkWa(l.contacto, l.tomador_nombre)}`
      ),
    });
  }

  if (vencidos.data?.length) {
    secciones.push({
      encabezado: `💳 Suscripciones con pago vencido (${vencidos.data.length})`,
      lineas: vencidos.data.map(
        (s) => `Plan ${esc(s.plan ?? "?")} — ${s.avisos_dunning} aviso(s) enviados`
      ),
    });
  }

  if (escalados.data?.length) {
    secciones.push({
      encabezado: `💬 Chats de soporte escalados (${escalados.data.length})`,
      lineas: escalados.data.map((c) => {
        const msgs = Array.isArray(c.mensajes) ? c.mensajes : [];
        const ultimo = [...msgs].reverse().find((m) => m?.rol === "user");
        return `En ${esc(c.pagina ?? "?")}: “${esc(String(ultimo?.texto ?? "").slice(0, 120))}”`;
      }),
    });
  }

  // MRR aproximado con las suscripciones activas (cortesía cuenta $0).
  const mrr = (activas.data ?? []).reduce((suma, s) => {
    const plan = PLANES.find((p) => p.clave === s.plan);
    return suma + (plan?.precio ?? 0);
  }, 0);
  if (activas.data?.length) {
    secciones.push({
      encabezado: "📈 Estado del negocio",
      lineas: [
        `${activas.data.length} suscripción(es) activa(s)`,
        `MRR aproximado: $${mrr.toLocaleString("es-MX")} MXN`,
      ],
    });
  }

  if (secciones.length === 0) {
    return NextResponse.json({ ok: true, enviado: false, motivo: "Nada que reportar." });
  }
  if (rotas.length === 5) {
    // Las cinco consultas rotas no es "un resumen con avisos": es la base caída.
    await alertar("el resumen diario no pudo leer nada", `Fallaron las 5 consultas del digest.`);
  }

  const envio = await enviarEmail({
    to: NOTIFY_EMAIL,
    ...emailDigest({ titulo: "☀️ Tu resumen de Kora de hoy", secciones }),
  });

  return NextResponse.json({
    ok: true,
    enviado: envio.ok,
    error: envio.ok ? undefined : envio.error,
    secciones: secciones.length,
  });
}
