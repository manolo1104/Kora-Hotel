import { NextResponse } from "next/server";
import { z } from "zod";
import { negar } from "@/lib/panel/permisos";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { leerCuerpo } from "@/lib/api/cuerpo";
import { postAlRuntime } from "@/lib/bot/runtime";
import { getHiloCamila, guardarEstadoChat, ETIQUETAS_CHAT } from "@/lib/db/admin";

export const dynamic = "force-dynamic";

// El estado de trabajo de UN hilo de la bandeja: etiquetas, «Camila responde /
// yo contesto», y la marca de leído.
//
// Todo se guarda en la base (`camila_conversaciones`) y no en la memoria del
// runtime: hasta ahora la pausa por chat vivía en un `Map` de Railway, y cada
// despliegue —que son varios al día— la borraba sin que nadie se enterara.
//
// Si NO se pudo guardar, se dice. Es la misma lección del interruptor de Camila:
// el panel llegó a enseñar «Guardado ✓» sobre una base que no había cambiado.

const ESQUEMA = z.object({
  chatId: z.string().trim().min(1).max(80),
  etiquetas: z.array(z.enum(ETIQUETAS_CHAT)).max(ETIQUETAS_CHAT.length).optional(),
  /** Minutos de pausa; `0` reanuda a Camila. */
  pausarMin: z.number().int().min(0).max(1440).optional(),
  /** Marcar el hilo como leído ahora. */
  visto: z.boolean().optional(),
});

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ ok: false, error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "bot:responder");
  if (no) return no;

  const c = await leerCuerpo(req, ESQUEMA);
  if (!c.ok) return NextResponse.json({ ok: false, error: "Datos inválidos." }, { status: 400 });
  const { chatId, etiquetas, pausarMin, visto } = c.datos;

  // El hilo, buscado por el hotel de la SESIÓN: etiquetar el chat de otro hotel
  // no es posible aunque se adivine el teléfono.
  const hilo = await getHiloCamila(ctx.hotelId, chatId);
  if (!hilo) {
    return NextResponse.json({ ok: false, error: "Esa conversación no existe en tu hotel." }, { status: 404 });
  }

  const ahora = new Date();
  const pausadoHasta =
    pausarMin === undefined
      ? undefined
      : pausarMin > 0
        ? new Date(ahora.getTime() + pausarMin * 60_000).toISOString()
        : null;

  const guardado = await guardarEstadoChat(ctx.hotelId, chatId, {
    ...(etiquetas !== undefined ? { etiquetas } : {}),
    ...(pausadoHasta !== undefined ? { pausadoHasta } : {}),
    ...(visto ? { vistoAt: ahora.toISOString() } : {}),
  });

  if (!guardado) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "No pude guardarlo. Si acabas de estrenar la bandeja, falta correr sql/kora-camila-bandeja.sql en Supabase.",
      },
      { status: 503 },
    );
  }

  // Que el runtime se entere ya, sin esperar a que expire su caché. Mejor
  // esfuerzo —la fuente de verdad es la base, que él consulta igualmente— pero
  // un fallo se registra: es un minuto en el que Camila puede contestar encima.
  if (pausadoHasta !== undefined) {
    const avisado = await postAlRuntime("/pausa", { slug: ctx.hotel.slug, chatId, hasta: pausadoHasta });
    if (!avisado.ok) console.warn(`[camila-chat] pausa no avisada al runtime: ${avisado.fallo}`);
  }

  return NextResponse.json({ ok: true, pausadoHasta: pausadoHasta ?? hilo.pausadoHasta });
}
