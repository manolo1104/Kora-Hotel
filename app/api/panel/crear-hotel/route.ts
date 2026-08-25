import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseEnvReady } from "@/lib/supabase/env";
import { enviarEmail, NOTIFY_EMAIL } from "@/lib/email/resend";
import { sendBienvenidaHotel } from "@/lib/email/prueba";
import { emailHotelNuevo } from "@/lib/email/templates";
import { contarHotelesPropios, MAX_HOTELES_POR_CUENTA } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Alta de un hotel (multi-tenant). El usuario autenticado queda como owner_id;
// un TRIGGER en la BD siembra hotel_members(owner_id,'dueno') automáticamente.
// Insertamos con el cliente de SERVIDOR con sesión para que aplique la RLS de
// inserción (auth.uid() = owner_id). El hotel_id NUNCA se toma del body.

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function toNum(v: unknown, fallback = 0): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  // Conservar el punto decimal: "1,500.50" → 1500.5 (parseInt daba 150050).
  if (typeof v === "string") return parseFloat(v.replace(/[^0-9.]/g, "")) || fallback;
  return fallback;
}

interface HabitacionInput {
  nombre?: string;
  precio?: number | string;
  maxGuests?: number | string;
  capacidad?: number | string;
  descripcion?: string;
  priceTiers?: Record<string, number | string>;
}

// Postgres: unique_violation (slug duplicado) / undefined_column (falta una col).
const UNIQUE_VIOLATION = "23505";
const COL_FALTANTE = "42703";

export async function POST(req: Request) {
  if (!supabaseEnvReady) {
    return NextResponse.json(
      { ok: false, error: "Las cuentas todavía no están activas." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Inicia sesión para crear tu hotel." }, { status: 401 });
  }

  // Tope por cuenta: una cuenta puede tener hasta MAX_HOTELES_POR_CUENTA hoteles
  // propios. Es la barrera real (la UI también oculta el botón, pero esto cierra
  // el paso directo por API).
  const propios = await contarHotelesPropios(user.id);
  if (propios >= MAX_HOTELES_POR_CUENTA) {
    return NextResponse.json(
      {
        ok: false,
        error: `Máximo ${MAX_HOTELES_POR_CUENTA} hoteles por cuenta. ¿Necesitas más? Escríbenos.`,
      },
      { status: 403 },
    );
  }

  let body: {
    nombre?: string;
    ubicacion?: string;
    whatsapp?: string;
    descripcion?: string;
    habitaciones?: HabitacionInput[];
    prefijo?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Datos inválidos." }, { status: 400 });
  }

  const nombre = (body.nombre ?? "").trim();
  if (nombre.length < 2) {
    return NextResponse.json({ ok: false, error: "Ponle un nombre a tu hotel." }, { status: 400 });
  }

  // Normaliza los cuartos al formato que consume el motor (lib/booking/rooms.ts):
  // {nombre, precio, maxGuests, descripcion?, priceTiers?}.
  const habitacionesRaw = Array.isArray(body.habitaciones) ? body.habitaciones : [];
  const habitaciones = habitacionesRaw
    .map((h) => {
      const nom = String(h?.nombre ?? "").trim();
      const precio = toNum(h?.precio, 0);
      if (!nom || precio <= 0) return null;
      const maxGuests = toNum(h?.maxGuests ?? h?.capacidad, 2) || 2;
      const hab: {
        nombre: string;
        precio: number;
        maxGuests: number;
        descripcion?: string;
        priceTiers?: Record<string, number>;
      } = { nombre: nom, precio, maxGuests };
      const desc = String(h?.descripcion ?? "").trim();
      if (desc) hab.descripcion = desc;
      if (h?.priceTiers && typeof h.priceTiers === "object") {
        const tiers: Record<string, number> = {};
        for (const [k, v] of Object.entries(h.priceTiers)) {
          const g = Number(k);
          const p = toNum(v, 0);
          if (!Number.isNaN(g) && p > 0) tiers[String(g)] = p;
        }
        if (Object.keys(tiers).length > 0) hab.priceTiers = tiers;
      }
      return hab;
    })
    .filter((h): h is NonNullable<typeof h> => h !== null);

  if (habitaciones.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Agrega al menos una habitación con precio." },
      { status: 400 }
    );
  }

  const payloadBase = {
    owner_id: user.id,
    nombre,
    ubicacion: (body.ubicacion ?? "").trim() || null,
    whatsapp: (body.whatsapp ?? "").trim() || null,
    descripcion: (body.descripcion ?? "").trim() || null,
    habitaciones,
    publicado: true,
  };
  const prefijo = (body.prefijo ?? "").trim();
  const payload = prefijo ? { ...payloadBase, prefijo_confirmacion: prefijo.toUpperCase() } : payloadBase;

  // Slug: slugify(nombre) y, si choca el unique, reintenta con sufijo aleatorio
  // (mismo patrón que PanelEditor). Degradamos sin prefijo_confirmacion si la
  // columna no existe en este entorno.
  const base = slugify(nombre) || "hotel";
  let usarPrefijo = Boolean(prefijo);
  let creado: { id: string; slug: string } | null = null;
  let ultimoError: { message?: string } | null = null;

  for (let i = 0; i < 6 && !creado; i++) {
    const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const cuerpo = usarPrefijo ? payload : payloadBase;
    const { data, error } = await supabase
      .from("hoteles")
      .insert({ ...cuerpo, slug })
      .select("id, slug")
      .single();

    if (!error && data) {
      creado = data as { id: string; slug: string };
    } else if (error?.code === COL_FALTANTE && usarPrefijo) {
      usarPrefijo = false;
      i--; // reintenta el mismo slug sin la columna faltante
    } else if (error?.code === UNIQUE_VIOLATION) {
      continue; // slug tomado: probamos otro sufijo
    } else {
      ultimoError = error;
      break; // error real (RLS, etc.): no insistir
    }
  }

  if (!creado) {
    const msg = ultimoError?.message
      ? "No se pudo crear tu hotel. Inténtalo de nuevo."
      : "No se pudo generar una dirección para tu hotel. Prueba con otro nombre.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }

  // Aviso instantáneo a Kora cada vez que se registra un hotel nuevo.
  // Best-effort: el hotel ya quedó guardado, el correo nunca tumba el alta.
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const usuario =
    typeof meta.name === "string" ? meta.name : typeof meta.full_name === "string" ? meta.full_name : null;
  let count: number | null = null;
  try {
    const { count: n } = await createAdminClient()
      .from("hoteles")
      .select("id", { count: "exact", head: true });
    count = typeof n === "number" ? n : null;
  } catch {
    /* el conteo es opcional (solo el badge) */
  }
  // Bienvenida AL HOTELERO el mismo día. Antes su primer correo de Kora llegaba
  // el día 20 de la prueba de 30: veinte días de silencio en el momento donde se
  // decide si activa o abandona. Best-effort: el hotel ya quedó creado.
  // OJO: estos envíos van CON await. Sin él son "floating promises": Vercel
  // congela la función en cuanto respondemos y la petición a Resend se queda a
  // medias. Así se perdieron los avisos de los dos hoteles del 22/08/2026 —
  // el del 19/08 sí salió, porque es una carrera que a veces se gana.
  if (user.email) {
    await sendBienvenidaHotel(user.email, {
      hotelNombre: (body.nombre || "").trim() || creado.slug,
      slug: creado.slug,
      nombreUsuario: usuario,
    }).catch(() => {});
  }

  await enviarEmail({
    to: NOTIFY_EMAIL || "daftpunkmanolo@gmail.com",
    ...emailHotelNuevo({
      hotel: (body.nombre || "").trim() || creado.slug,
      ubicacion: body.ubicacion,
      whatsapp: body.whatsapp,
      email: user.email,
      slug: creado.slug,
      usuario,
      count,
    }),
  }).catch(() => {});

  return NextResponse.json({ ok: true, slug: creado.slug });
}
