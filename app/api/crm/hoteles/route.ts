import { NextResponse } from "next/server";
import { requireCrmAuth } from "@/lib/crm/auth";
import { createAdminClient, adminEnvReady } from "@/lib/supabase/admin";
import { bloqueoDelHotel } from "@/lib/suscripcion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Bloquear / desbloquear la cuenta de un hotel. SOLO el fundador (misma
// contraseña del CRM). El bloqueo se guarda en `hoteles.extras.bloqueo` y lo lee
// `accesoDelHotel`, que es el punto único por el que pasan panel, motor,
// checkout, bot y agente — por eso con esta sola bandera se apaga la cuenta
// entera sin borrar absolutamente nada.
//
// GET  → lista de hoteles con su estado.
// POST → { slug, bloquear: boolean, mensaje?: string }

interface HotelRow {
  id: string;
  slug: string;
  nombre: string;
  publicado: boolean | null;
  created_at: string | null;
  extras: Record<string, unknown> | null;
}

export async function GET() {
  const noAuth = await requireCrmAuth();
  if (noAuth) return noAuth;
  if (!adminEnvReady) return NextResponse.json({ error: "Sin BD." }, { status: 503 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("hoteles")
    .select("id, slug, nombre, publicado, created_at, extras")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[crm/hoteles] error leyendo hoteles:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const hoteles = ((data ?? []) as HotelRow[]).map((h) => {
    const bloqueo = bloqueoDelHotel(h.extras);
    return {
      slug: h.slug,
      nombre: h.nombre,
      publicado: h.publicado === true,
      demo: (h.extras ?? {}).demo === true,
      bloqueado: Boolean(bloqueo),
      mensaje: bloqueo?.mensaje ?? null,
      fecha: bloqueo?.fecha ?? null,
    };
  });

  return NextResponse.json({ ok: true, hoteles });
}

export async function POST(req: Request) {
  const noAuth = await requireCrmAuth();
  if (noAuth) return noAuth;
  if (!adminEnvReady) return NextResponse.json({ error: "Sin BD." }, { status: 503 });

  let body: { slug?: string; bloquear?: boolean; mensaje?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const slug = (body.slug ?? "").trim();
  if (!slug) return NextResponse.json({ error: "Falta el hotel." }, { status: 400 });
  const bloquear = body.bloquear === true;
  const mensaje = (body.mensaje ?? "").trim();

  if (bloquear && !mensaje) {
    return NextResponse.json(
      { error: "Escribe el mensaje que verá el hotelero al entrar." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Leer PRIMERO para no pisar el resto de `extras` (fotos, diseño, promos…):
  // se guarda el objeto completo con la llave `bloqueo` cambiada, nunca un
  // extras nuevo.
  const { data: hotel, error: leerErr } = await admin
    .from("hoteles")
    .select("id, slug, nombre, extras")
    .eq("slug", slug)
    .maybeSingle();

  if (leerErr) {
    console.error("[crm/hoteles] error leyendo hotel:", leerErr.message);
    return NextResponse.json({ error: leerErr.message }, { status: 500 });
  }
  if (!hotel) return NextResponse.json({ error: "No existe ese hotel." }, { status: 404 });

  const extras = ((hotel as HotelRow).extras ?? {}) as Record<string, unknown>;
  const extrasNuevos = { ...extras };
  if (bloquear) {
    extrasNuevos.bloqueo = { activo: true, mensaje, fecha: new Date().toISOString() };
  } else {
    delete extrasNuevos.bloqueo;
  }

  const { error: escribirErr } = await admin
    .from("hoteles")
    .update({ extras: extrasNuevos })
    .eq("id", (hotel as HotelRow).id);

  if (escribirErr) {
    console.error("[crm/hoteles] error guardando bloqueo:", escribirErr.message);
    return NextResponse.json({ error: escribirErr.message }, { status: 500 });
  }

  console.log(
    `[crm/hoteles] ${bloquear ? "BLOQUEADO" : "desbloqueado"}: ${(hotel as HotelRow).nombre} (${slug})`,
  );

  return NextResponse.json({
    ok: true,
    slug,
    nombre: (hotel as HotelRow).nombre,
    bloqueado: bloquear,
  });
}
