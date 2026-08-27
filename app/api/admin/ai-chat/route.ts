import { reservaCuenta } from "@/lib/booking/estado-reserva";
import { negar } from "@/lib/panel/permisos";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import {
  getAllBookings,
  getAllQuotes,
  getAgentMetrics,
  buildCRM,
} from "@/lib/db/admin";
import { calcInsights } from "@/lib/admin/insights";
import { totalUnits } from "@/lib/booking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Asistente IA del admin (multi-tenant). Mismo patrón de streaming de texto
// plano que mi-hotel/app/api/admin/ai-chat/route.ts: el cliente
// (InsightsClient.tsx) lee la respuesta con res.body.getReader() + TextDecoder
// y va concatenando los chunks crudos en la burbuja del asistente, así que
// DEBEMOS devolver un ReadableStream de texto (no JSON) cuando todo va bien.
// Para errores ANTES de empezar a streamear devolvemos JSON {error} con status
// != 200, que es lo único que el cliente parsea como error (rama !res.ok).

const MODEL = "claude-haiku-4-5";
const MAX_TOKENS = 2048;
const TOTAL_SUITES = 13; // respaldo si el hotel aún no configura sus cuartos
const RES_MAX = 250;
const COT_MAX = 200;
const HUESP_MAX = 250;

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const fmtMoney = (n: number) => `$${(n || 0).toLocaleString("es-MX")} MXN`;

/** Stream de UN solo mensaje de texto plano (para los casos "amables"). */
function textOnce(text: string): Response {
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
  return new Response(readable, { headers: STREAM_HEADERS });
}

const STREAM_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  // Evita que el proxy (Vercel/Nginx) acumule el stream en un buffer.
  "X-Accel-Buffering": "no",
} as const;

export async function POST(req: Request) {
  // 1) Tenant: identidad por sesión, hotel por cookie verificada contra members.
  const ctx = await getActiveHotel();
  if (!ctx) return new Response("no-auth", { status: 401 });
  const no = negar(ctx, "ia:usar");
  if (no) return no;

  // 2) Historial del cliente.
  let body: { messages?: ChatMsg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return NextResponse.json({ error: "messages requerido" }, { status: 400 });
  }

  // 3) Gated: sin llave, responde amable (texto plano, sin truenar el cliente).
  if (!process.env.ANTHROPIC_API_KEY) {
    return textOnce(
      "El asistente con IA aún no está activado en tu cuenta. Mientras tanto " +
        "puedes operar todo desde el panel, y aquí seguirás viendo tus métricas " +
        "en tiempo real. Si quieres habilitarlo, escríbenos.",
    );
  }

  // 4) Datos del hotel (filtrados por hotelId). En paralelo; si algo falla,
  //    las funciones de lib/db/admin ya devuelven [] (no lanzan).
  const hotelId = ctx.hotelId;
  const hotelNombre = ctx.hotel.nombre || "tu hotel";
  const totalCuartos = totalUnits(ctx.hotel) || TOTAL_SUITES;

  let bookings: Awaited<ReturnType<typeof getAllBookings>> = [];
  let quotes: Awaited<ReturnType<typeof getAllQuotes>> = [];
  let agentMetrics: Awaited<ReturnType<typeof getAgentMetrics>> = [];
  let guests: Awaited<ReturnType<typeof buildCRM>> = [];
  try {
    [bookings, quotes, agentMetrics, guests] = await Promise.all([
      getAllBookings(hotelId),
      getAllQuotes(hotelId),
      getAgentMetrics(hotelId),
      buildCRM(hotelId),
    ]);
  } catch (e) {
    console.error("[ai-chat] error cargando datos del hotel:", e);
    return NextResponse.json(
      {
        error:
          "Datos del hotel no disponibles temporalmente. Intenta de nuevo en unos segundos.",
        retry: true,
      },
      { status: 503 },
    );
  }

  const insights = calcInsights(bookings, agentMetrics, totalCuartos);
  const now = new Date();

  // ── Detalle completo para el asistente (reservas, cotizaciones, huéspedes) ──
  const sortedBookings = [...bookings].sort((a, b) =>
    (b.checkin || "").localeCompare(a.checkin || ""),
  );
  const reservasTxt = sortedBookings
    .slice(0, RES_MAX)
    .map((b) => {
      const restante = (b.total || 0) - (b.anticipo || 0);
      const pago = b.anticipo
        ? ` (anticipo ${fmtMoney(b.anticipo)}, resta ${fmtMoney(restante)})`
        : "";
      return `[${b.confirmacion}] ${b.cliente} · tel ${b.telefono || "s/d"} · ${b.email || "s/d"} | ${b.checkin}→${b.checkout} (${b.noches}n) | ${b.habitaciones} | ${b.huespedes} huésp | ${fmtMoney(b.total)}${pago} | ${b.estado}${b.comoNosConocio ? ` | vía ${b.comoNosConocio}` : ""}${b.notas ? ` | notas: ${b.notas}` : ""}`;
    })
    .join("\n");
  const reservasExtra =
    sortedBookings.length > RES_MAX
      ? `\n(+${sortedBookings.length - RES_MAX} reservas más antiguas no listadas)`
      : "";

  const sortedQuotes = [...quotes].sort((a, b) =>
    (b.fecha || "").localeCompare(a.fecha || ""),
  );
  const cotizacionesTxt = sortedQuotes
    .slice(0, COT_MAX)
    .map(
      (q) =>
        `[${q.id}] ${q.cliente} · tel ${q.telefono || "s/d"} · ${q.email || "s/d"} | ${q.suite} | ${q.checkin}→${q.checkout} (${q.noches}n) | ${fmtMoney(q.precioTotal)} | ${q.estado}${q.notas ? ` | notas: ${q.notas}` : ""}`,
    )
    .join("\n");
  const cotizacionesExtra =
    sortedQuotes.length > COT_MAX
      ? `\n(+${sortedQuotes.length - COT_MAX} cotizaciones más no listadas)`
      : "";

  const huespedesTxt = guests
    .slice(0, HUESP_MAX)
    .map(
      (g) =>
        `${g.nombre} · ${g.email} · tel ${g.telefono || "s/d"} | ${g.totalReservas} reserva(s) | gastado ${fmtMoney(g.totalGastado)} | última ${g.ultimaEstancia || "s/d"} | suites: ${g.suitesFavoritas.join(", ") || "s/d"} | WA: ${g.waConversaciones}${g.notas ? ` | notas: ${g.notas}` : ""}`,
    )
    .join("\n");
  const huespedesExtra =
    guests.length > HUESP_MAX
      ? `\n(+${guests.length - HUESP_MAX} huéspedes más no listados)`
      : "";

  const cotizacionesActivas = sortedQuotes.filter(
    (q) => q.estado === "ENVIADA" || q.estado === "BORRADOR",
  ).length;
  const reservasActivas = bookings.filter(
    (b) => reservaCuenta(b.estado),
  ).length;

  const systemPrompt = `Eres el asistente de inteligencia de ${hotelNombre}.
Ayudas al dueño del hotel a entender y gestionar los datos de su negocio en tiempo real. Tienes acceso COMPLETO a
todas las reservas, cotizaciones y perfiles de huéspedes (incluidos nombres, teléfonos, correos, montos y notas) que
aparecen más abajo, y SOLO de este hotel. Úsalos para responder cualquier pregunta sobre un huésped, una reserva o una
cotización específica (p. ej. datos de contacto, fechas, montos, historial, quién llega tal día, cuánto debe alguien).
Responde siempre en español, de forma concisa y orientada a acción. Cuando hay números, sé específico. Estos datos son
confidenciales del hotel y solo se muestran al dueño en su panel protegido, así que puedes compartirlos con él; pero
NUNCA inventes datos que no estén en las listas: si algo no aparece, dilo claramente.

=== DATOS EN TIEMPO REAL — ${now.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} ===

HOY:
- Suites ocupadas: ${insights.hoy.suitesOcupadas} de ${totalCuartos} (${insights.hoy.porcentajeOcupacion}%)
- Check-ins hoy: ${insights.hoy.movimientos.filter((m) => m.tipo === "checkin").length}
- Check-outs hoy: ${insights.hoy.movimientos.filter((m) => m.tipo === "checkout").length}
${insights.hoy.movimientos.map((m) => `  • ${m.tipo === "checkin" ? "▶ Llegada" : "◀ Salida"}: ${m.cliente} | ${m.habitaciones} | ${m.huespedes} huéspedes`).join("\n")}

MES ACTUAL (${now.toLocaleDateString("es-MX", { month: "long", year: "numeric" })}):
- Ingresos: $${insights.mes.ingresos.toLocaleString("es-MX")} MXN
- Reservas: ${insights.mes.reservas}
- Ocupación: ${insights.mes.ocupacion}%
- ADR (tarifa promedio por noche): $${insights.mes.adr.toLocaleString("es-MX")} MXN
- RevPAR: $${insights.mes.revpar.toLocaleString("es-MX")} MXN

PRÓXIMOS 7 DÍAS:
${insights.forecast7dias.map((d) => `- ${d.label} (${d.fecha}): ${d.ocupadas}/${totalCuartos} suites (${d.porcentaje}%)`).join("\n")}

ORIGEN DE RESERVAS (mes actual):
${insights.origen.length ? insights.origen.map((o) => `- ${o.label}: ${o.count} reservas ($${o.ingresos.toLocaleString("es-MX")} MXN)`).join("\n") : "- (sin reservas este mes aún)"}

AHORRO EN COMISIONES OTA (año corriente): $${insights.ahorroOTAs.toLocaleString("es-MX")} MXN

AGENTES:
- Bot WhatsApp hoy: ${insights.agentes.whatsapp.conversacionesHoy} conversaciones
- Bot WhatsApp mes: ${insights.agentes.whatsapp.conversacionesMes} conversaciones
- Emails confirmación (mes): ${insights.agentes.emails.confirmacion}
- Emails pre-estancia (mes): ${insights.agentes.emails.preestancia}
- Emails post-estancia (mes): ${insights.agentes.emails.postestancia}

COTIZACIONES ACTIVAS: ${cotizacionesActivas} pendientes de ${quotes.length} totales
TOTAL RESERVAS EN SISTEMA: ${bookings.length} (${reservasActivas} activas)

=== RESERVAS DETALLADAS (todas, las más recientes/futuras primero) ===
Formato: [confirmación] cliente · teléfono · email | llegada→salida (noches) | habitaciones | huéspedes | total (anticipo/resta) | estado | vía (cómo nos conoció) | notas
${reservasTxt || "(sin reservas)"}${reservasExtra}

=== COTIZACIONES (todas) ===
Formato: [id] cliente · teléfono · email | suite | llegada→salida (noches) | precio | estado | notas
${cotizacionesTxt || "(sin cotizaciones)"}${cotizacionesExtra}

=== HUÉSPEDES / CRM (todos los que tienen email, ordenados por gasto total) ===
Formato: nombre · email · teléfono | nº reservas | total gastado | última estancia | suites | conversaciones WhatsApp | notas
${huespedesTxt || "(sin huéspedes)"}${huespedesExtra}`;

  // 5) Streaming de texto plano (lo que el cliente espera).
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: [
            {
              type: "text",
              text: systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: messages.map((m) => ({
            role: m.role === "user" ? ("user" as const) : ("assistant" as const),
            content: m.content,
          })),
        });

        let emitted = false;
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            emitted = true;
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }

        if (!emitted) {
          controller.enqueue(
            encoder.encode("No recibí respuesta del modelo. Intenta de nuevo."),
          );
        }
      } catch (err) {
        // No dejes que el error se trague en silencio: regístralo y dilo en el chat.
        const e = err as { status?: number; message?: string };
        console.error("[ai-chat] Error de Anthropic:", e?.status, e?.message || err);
        const msg =
          e?.status === 401
            ? "⚠️ La llave de la API de IA es inválida o expiró. Revisa ANTHROPIC_API_KEY."
            : "⚠️ Hubo un error al generar la respuesta. Intenta de nuevo en unos segundos.";
        controller.enqueue(encoder.encode(msg));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, { headers: STREAM_HEADERS });
}
