import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmAuth } from "@/lib/crm/auth";
import { requireCrmMutacion } from "@/lib/crm/guardas";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { leerCuerpo } from "@/lib/api/cuerpo";
import { limitado, ipDe } from "@/lib/api/rate-limit";
import { registrarAccion } from "@/lib/crm/bitacora";
import { sanitizeLead } from "@/lib/crm/server";
import {
  cargarChats,
  cuerpoLeadDeChat,
  esUuid,
  faltaColumna,
  faltaTabla,
  leadExistenteDeChat,
  leerChat,
} from "@/lib/crm/bandeja";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Los chats de la web que el asistente de soporte escaló a una persona.
//
// GET  → los chats escalados, los que piden atención primero.
// POST → { accion: "atender", id, atendido }        marca (o desmarca) atendido
//        { accion: "a_lead", id, hotel_nombre, … }  crea el prospecto en crm_leads
//
// Hasta el 15 sep 2026 un chat escalado sólo se podía leer abriendo Supabase, y
// convertirlo en prospecto era copiar a mano el texto al formulario de leads. El
// visitante que pidió hablar con una persona es el lead más caliente que llega
// por la web; perderlo en una tabla que nadie abre era perder la venta.

const TEXTO_CORTO = 200;

const zId = z.string().refine(esUuid);
const zOpcional = z.string().trim().max(TEXTO_CORTO).optional();

const ESQUEMA = z.discriminatedUnion("accion", [
  z.object({ accion: z.literal("atender"), id: zId, atendido: z.boolean() }),
  z.object({
    accion: z.literal("a_lead"),
    id: zId,
    hotel_nombre: z.string().trim().min(1).max(TEXTO_CORTO),
    tomador_nombre: zOpcional,
    contacto: zOpcional,
    email: zOpcional,
    ciudad: zOpcional,
    nota: z.string().max(1_000).optional(),
    secuencia: z.boolean(),
  }),
]);

// Suelto a propósito: si el correo va mal escrito, la pantalla tiene que decir
// «ese correo», no un «Datos inválidos» que no dice qué campo corregir.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function error(status: number, texto: string): NextResponse {
  return NextResponse.json({ error: texto }, { status });
}

const NO_SE_CAMBIO = "No se cambió nada.";

export async function GET() {
  const noAuth = await requireCrmAuth();
  if (noAuth) return noAuth;
  const r = await cargarChats();
  if (r.estado === "error") return error(503, r.detalle);
  if (r.estado === "falta-sql") return NextResponse.json({ ok: true, faltaSql: r.archivo, chats: [] });
  return NextResponse.json({ ok: true, ...r.data, ...(r.aviso ? { aviso: r.aviso } : {}) });
}

export async function POST(req: Request) {
  const no = await requireCrmMutacion(req);
  if (no) return no;
  if (!adminEnvReady) return error(503, "No hay conexión a la base de datos.");

  if (await limitado("crm.bandeja", ipDe(req), { max: 120, ventanaMs: 10 * 60_000 })) {
    return error(429, "Demasiadas acciones seguidas. Espera unos minutos.");
  }

  const c = await leerCuerpo(req, ESQUEMA);
  if (!c.ok) return c.respuesta;
  const cuerpo = c.datos;

  const r = await leerChat(cuerpo.id);
  if (r.estado === "falta-sql") return error(409, `Falta correr ${r.archivo}. ${NO_SE_CAMBIO}`);
  if (r.estado === "error") return error(503, `${r.detalle} ${NO_SE_CAMBIO}`);
  const { chat, puedeAtender } = r.data;
  if (!chat) return error(404, "Ese chat ya no existe.");

  const admin = createAdminClient();

  try {
    // ── Marcar atendido / reabrir ─────────────────────────────────────────
    if (cuerpo.accion === "atender") {
      if (!puedeAtender) return error(409, `Falta correr sql/kora-crm-mando.sql. ${NO_SE_CAMBIO}`);

      const atendidoAt = cuerpo.atendido ? new Date().toISOString() : null;
      const { error: e } = await admin
        .from("soporte_conversaciones")
        .update({ atendido_at: atendidoAt })
        .eq("id", chat.id);
      if (e) {
        console.error(`[crm/soporte] no se pudo marcar el chat ${chat.id}:`, e.message);
        return error(503, `No se pudo guardar. ${NO_SE_CAMBIO} Intenta de nuevo en un momento.`);
      }

      const apuntado = await registrarAccion({
        accion: cuerpo.atendido ? "soporte.atender" : "soporte.reabrir",
        antes: { atendido_at: chat.atendido_at },
        despues: { atendido_at: atendidoAt },
        detalle: { chat_id: chat.id, pagina: chat.pagina },
      });
      return NextResponse.json({
        ok: true,
        atendido_at: atendidoAt,
        ...(apuntado ? {} : { aviso: "Se guardó, pero no quedó apuntado en la bitácora." }),
      });
    }

    // ── Pasar a lead ──────────────────────────────────────────────────────
    const email = cuerpo.email?.trim() ?? "";
    if (email && !EMAIL.test(email)) return error(400, "Ese correo no parece válido. Revísalo o déjalo vacío.");

    // Antes de crear, ¿ya se creó? Un doble clic o un reintento tras un corte de
    // red duplicaría el prospecto, y con la secuencia encendida le llegarían dos
    // veces los mismos correos. Si no se puede comprobar, no se crea a ciegas.
    const previo = await leadExistenteDeChat(chat.id);
    if (!previo.ok) {
      return error(503, `No se pudo comprobar si este chat ya es un lead. ${NO_SE_CAMBIO} Intenta de nuevo.`);
    }
    if (previo.leadId) {
      return NextResponse.json({ ok: true, leadId: previo.leadId, yaExistia: true, mensaje: "Este chat ya era un lead." });
    }

    const { data: datosLead, error: invalido } = sanitizeLead(
      cuerpoLeadDeChat(chat, {
        hotel_nombre: cuerpo.hotel_nombre,
        tomador_nombre: cuerpo.tomador_nombre,
        contacto: cuerpo.contacto,
        email,
        ciudad: cuerpo.ciudad,
        nota: cuerpo.nota,
        secuencia: cuerpo.secuencia,
      }),
      "create",
    );
    if (invalido || !datosLead) return error(400, invalido ?? "Datos inválidos.");

    let insercion = await admin.from("crm_leads").insert(datosLead).select("id").single();
    // `secuencia_pausada` llega con sql/kora-correos-seguimiento.sql. Sin esa
    // columna tampoco hay cron de secuencia que la lea, así que crear el lead
    // sin ella no manda ningún correo de más.
    if (insercion.error && faltaColumna(insercion.error, "secuencia_pausada")) {
      const sinSecuencia = { ...datosLead };
      delete sinSecuencia.secuencia_pausada;
      insercion = await admin.from("crm_leads").insert(sinSecuencia).select("id").single();
    }
    if (insercion.error || !insercion.data) {
      if (insercion.error && faltaTabla(insercion.error)) {
        return error(409, `Falta correr sql/kora-crm-schema.sql. ${NO_SE_CAMBIO}`);
      }
      console.error(`[crm/soporte] no se pudo crear el lead del chat ${chat.id}:`, insercion.error?.message);
      return error(503, `No se pudo crear el lead. ${NO_SE_CAMBIO} Intenta de nuevo en un momento.`);
    }
    const leadId = (insercion.data as { id: string }).id;

    // Pasarlo a lead ES atenderlo. Mejor-esfuerzo: el lead ya existe, y que
    // falle esta marca no puede convertir en error algo que sí se hizo (el
    // fundador lo reintentaría; la marca de las notas evita el duplicado, pero
    // el mensaje rojo sería mentira).
    let atendidoAt = chat.atendido_at;
    if (puedeAtender && !chat.atendido_at) {
      const ahora = new Date().toISOString();
      const { error: e } = await admin.from("soporte_conversaciones").update({ atendido_at: ahora }).eq("id", chat.id);
      if (e) console.error(`[crm/soporte] lead creado, pero no se marcó atendido el chat ${chat.id}:`, e.message);
      else atendidoAt = ahora;
    }

    const apuntado = await registrarAccion({
      accion: "soporte.a_lead",
      detalle: { chat_id: chat.id, lead_id: leadId, secuencia: cuerpo.secuencia, pagina: chat.pagina },
    });
    return NextResponse.json({
      ok: true,
      leadId,
      atendido_at: atendidoAt,
      ...(apuntado ? {} : { aviso: "Se creó, pero no quedó apuntado en la bitácora." }),
    });
  } catch (err) {
    console.error("[crm/soporte] error:", err);
    return error(500, "Algo falló. Recarga la página y vuelve a intentarlo.");
  }
}
