import { negar, puedeCtx } from "@/lib/panel/permisos";
// «Lo que Camila sabe»: los datos rápidos del hotel que más preguntan los
// huéspedes, editables DESDE la pantalla de Camila.
//
// No son datos nuevos ni una copia: son los MISMOS campos que edita Mi sitio
// (dirección, horarios de la guía, políticas de mascotas y niños, formas de pago,
// idiomas). Antes la pantalla de Camila sólo los enseñaba como una lista de
// chequeo con links a otra pantalla —algunos rotos— y el hotelero tenía que
// adivinar dónde se cambiaba cada cosa.
//
// Se guarda POR CAMPOS (sólo lo que viene) y releyendo la fila justo antes de
// escribir, para no pisar lo que Mi sitio u otra pestaña guardaron.

import { NextResponse } from "next/server";
import { getActiveHotel } from "@/lib/panel/active-hotel";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeFaqs } from "@/lib/bot/prompt";
import { FORMAS_PAGO, IDIOMAS } from "@/lib/mini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HORA = /^([01]?\d|2[0-3]):[0-5]\d$/;
const texto = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const deLista = (v: unknown, permitidos: readonly string[]) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === "string" && permitidos.includes(x)))] : [];

export async function GET() {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "bot:leer");
  if (no) return no;
  const h = ctx.hotel;
  const extras = (h.extras ?? {}) as Record<string, unknown>;
  const guia = (h.guia ?? {}) as Record<string, unknown>;
  const pol = (extras.politicas ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    ok: true,
    puedeEditar: puedeCtx(ctx, "sitio:editar"),
    datos: {
      ubicacion: texto(h.ubicacion, 300),
      checkin: texto(guia.checkin, 20),
      checkout: texto(guia.checkout, 20),
      mascotas: texto(pol.mascotas, 600),
      ninos: texto(pol.ninos, 600),
      formasPago: deLista(extras.formasPago, FORMAS_PAGO),
      idiomas: deLista(extras.idiomas, IDIOMAS),
      mapsUrl: texto(extras.mapsUrl, 500),
    },
    // Las del sitio salen también en la página pública; aquí se enseñan para
    // que el hotelero vea TODO lo que Camila contesta, y se editan en Mi sitio.
    faqsSitio: normalizeFaqs(extras.faqs).map((f) => ({ q: f.q, a: f.a ?? "" })),
  });
}

export async function POST(req: Request) {
  const ctx = await getActiveHotel();
  if (!ctx) return NextResponse.json({ error: "no-auth" }, { status: 401 });
  const no = negar(ctx, "sitio:editar");
  if (no) return no;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad-request" }, { status: 400 });
  }
  const tiene = (k: string) => Object.prototype.hasOwnProperty.call(body, k);

  for (const k of ["checkin", "checkout"]) {
    if (tiene(k) && texto(body[k], 20) && !HORA.test(texto(body[k], 20))) {
      return NextResponse.json({ ok: false, error: "hora-invalida", campo: k }, { status: 400 });
    }
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("hoteles")
    .select("guia, extras")
    .eq("id", ctx.hotelId)
    .maybeSingle();
  if (error || !data) {
    console.error("camila-sabe (leer):", error?.message);
    return NextResponse.json({ ok: false, error: "no-guardado" }, { status: 503 });
  }
  const guia = { ...((data.guia as Record<string, unknown>) ?? {}) };
  const extras = { ...((data.extras as Record<string, unknown>) ?? {}) };
  const politicas = { ...((extras.politicas as Record<string, unknown>) ?? {}) };
  const update: Record<string, unknown> = {};

  if (tiene("ubicacion")) update.ubicacion = texto(body.ubicacion, 300);
  if (tiene("checkin")) guia.checkin = texto(body.checkin, 20);
  if (tiene("checkout")) guia.checkout = texto(body.checkout, 20);
  if (tiene("checkin") || tiene("checkout")) update.guia = guia;
  if (tiene("mascotas")) politicas.mascotas = texto(body.mascotas, 600);
  if (tiene("ninos")) politicas.ninos = texto(body.ninos, 600);
  if (tiene("mascotas") || tiene("ninos")) extras.politicas = politicas;
  if (tiene("formasPago")) extras.formasPago = deLista(body.formasPago, FORMAS_PAGO);
  if (tiene("idiomas")) extras.idiomas = deLista(body.idiomas, IDIOMAS);
  if (["mascotas", "ninos", "formasPago", "idiomas"].some(tiene)) update.extras = extras;

  if (!Object.keys(update).length) return NextResponse.json({ ok: true });
  const { error: errUpd } = await supabase.from("hoteles").update(update).eq("id", ctx.hotelId);
  if (errUpd) {
    console.error("camila-sabe (escribir):", errUpd.message);
    return NextResponse.json({ ok: false, error: "no-guardado" }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
