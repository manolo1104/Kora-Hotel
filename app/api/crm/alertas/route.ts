import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCrmAuth } from "@/lib/crm/auth";
import { requireCrmMutacion } from "@/lib/crm/guardas";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { leerCuerpo } from "@/lib/api/cuerpo";
import { limitado, ipDe } from "@/lib/api/rate-limit";
import { registrarAccion } from "@/lib/crm/bitacora";
import { cargarAlertas, faltaTabla } from "@/lib/crm/bandeja";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Las alertas del camino del dinero, en la bandeja del fundador (/crm/bandeja).
//
// GET  → las alertas agrupadas, sin atender primero.
// POST → { accion: "atender", asunto, hasta }        marca atendidas todas las
//                                                    pendientes con ese asunto
//                                                    hasta la más reciente vista
//        { accion: "reabrir", asunto, atendida_at }  devuelve a pendientes las
//                                                    que se atendieron juntas
//
// Se marca POR GRUPO y no por lista de ids: un Stripe caído una hora deja
// cientos de filas con el mismo asunto, y cientos de uuids en la URL de la
// consulta rompen el límite de PostgREST. `hasta` es la fecha de la última que
// la pantalla ENSEÑABA: una alerta igual que llegue mientras el fundador lee NO
// se marca sin haberla visto.

const ASUNTO_MAX = 300;

// Una fecha tal como la devuelve PostgREST (`2026-09-15T10:00:00.123456+00:00`)
// o como la escribe `toISOString()`. Se compara tal cual en la base.
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}(:?\d{2})?)?$/;

const ESQUEMA = z.discriminatedUnion("accion", [
  z.object({
    accion: z.literal("atender"),
    // Sin `trim`: tiene que coincidir EXACTO con lo guardado.
    asunto: z.string().min(1).max(ASUNTO_MAX),
    hasta: z.string().regex(FECHA_ISO),
  }),
  z.object({
    accion: z.literal("reabrir"),
    asunto: z.string().min(1).max(ASUNTO_MAX),
    atendida_at: z.string().regex(FECHA_ISO),
  }),
]);

function error(status: number, texto: string): NextResponse {
  return NextResponse.json({ error: texto }, { status });
}

export async function GET() {
  const noAuth = await requireCrmAuth();
  if (noAuth) return noAuth;
  const r = await cargarAlertas();
  if (r.estado === "error") return error(503, r.detalle);
  if (r.estado === "falta-sql") return NextResponse.json({ ok: true, faltaSql: r.archivo, alertas: [], pendientes: 0 });
  return NextResponse.json({ ok: true, ...r.data, ...(r.aviso ? { aviso: r.aviso } : {}) });
}

export async function POST(req: Request) {
  const no = await requireCrmMutacion(req);
  if (no) return no;
  if (!adminEnvReady) return error(503, "No hay conexión a la base de datos.");

  // Holgado: marcar la bandeja entera son decenas de clics, no cientos. Está
  // para que un script en bucle con una cookie robada no pueda jugar con ella.
  if (await limitado("crm.bandeja", ipDe(req), { max: 120, ventanaMs: 10 * 60_000 })) {
    return error(429, "Demasiadas acciones seguidas. Espera unos minutos.");
  }

  const c = await leerCuerpo(req, ESQUEMA);
  if (!c.ok) return c.respuesta;
  const cuerpo = c.datos;
  const admin = createAdminClient();

  try {
    if (cuerpo.accion === "atender") {
      const ahora = new Date().toISOString();
      const { data, error: e } = await admin
        .from("alertas_fundador")
        .update({ atendida_at: ahora })
        .eq("asunto", cuerpo.asunto)
        .is("atendida_at", null)
        .lte("created_at", cuerpo.hasta)
        .select("id");
      if (e) {
        if (faltaTabla(e)) return error(409, "Falta correr sql/kora-crm-mando.sql. No se cambió nada.");
        console.error("[crm/alertas] no se pudo marcar atendida:", e.message);
        return error(503, "No se pudo marcar. Intenta de nuevo en un momento.");
      }
      const marcadas = (data ?? []).length;
      // Otro clic (u otra pestaña) se adelantó: ya estaba hecho, no es un error.
      if (marcadas === 0) return NextResponse.json({ ok: true, marcadas: 0, atendida_at: null, mensaje: "Ya estaba atendida." });

      const apuntado = await registrarAccion({
        accion: "alerta.atender",
        detalle: { asunto: cuerpo.asunto, marcadas, hasta: cuerpo.hasta },
        despues: { atendida_at: ahora },
      });
      return NextResponse.json({
        ok: true,
        marcadas,
        atendida_at: ahora,
        ...(apuntado ? {} : { aviso: "Se marcó, pero no quedó apuntado en la bitácora." }),
      });
    }

    const { data, error: e } = await admin
      .from("alertas_fundador")
      .update({ atendida_at: null })
      .eq("asunto", cuerpo.asunto)
      .eq("atendida_at", cuerpo.atendida_at)
      .select("id");
    if (e) {
      if (faltaTabla(e)) return error(409, "Falta correr sql/kora-crm-mando.sql. No se cambió nada.");
      console.error("[crm/alertas] no se pudo reabrir:", e.message);
      return error(503, "No se pudo reabrir. Intenta de nuevo en un momento.");
    }
    const reabiertas = (data ?? []).length;
    if (reabiertas === 0) return NextResponse.json({ ok: true, reabiertas: 0, mensaje: "Ya estaba pendiente." });

    const apuntado = await registrarAccion({
      accion: "alerta.reabrir",
      detalle: { asunto: cuerpo.asunto, reabiertas },
      antes: { atendida_at: cuerpo.atendida_at },
    });
    return NextResponse.json({
      ok: true,
      reabiertas,
      ...(apuntado ? {} : { aviso: "Se reabrió, pero no quedó apuntado en la bitácora." }),
    });
  } catch (err) {
    console.error("[crm/alertas] error:", err);
    return error(500, "Algo falló. Recarga la página y vuelve a intentarlo.");
  }
}
