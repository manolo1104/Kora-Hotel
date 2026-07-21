import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og";
import { COLOR_DEFAULT, inkFor, type MiniExtras } from "@/lib/mini";
import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseEnvReady } from "@/lib/supabase/env";

// Portada Open Graph por HOTEL (1200×630): foto de portada del hotel con su
// nombre, ubicación y precio "desde", en el color de marca que eligió en el
// panel. Es lo que se ve al compartir /h/[slug] en WhatsApp, Facebook o Google.
export const alt = "Portada del hotel";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface Habitacion {
  precio?: string;
  tarifas?: { precio?: string }[];
}

function aNumero(p?: string): number {
  return Number(String(p ?? "").replace(/[^0-9.]/g, ""));
}

function precioDesde(habitaciones: Habitacion[]): number | null {
  const nums = habitaciones
    .flatMap((h) => [aNumero(h.precio), ...(h.tarifas ?? []).map((t) => aNumero(t.precio))])
    .filter((n) => n > 0);
  return nums.length ? Math.min(...nums) : null;
}

export default async function OgHotel({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let nombre = "Hotel";
  let ubicacion: string | null = null;
  let foto: string | null = null;
  let color = COLOR_DEFAULT;
  let desde: number | null = null;

  if (supabaseEnvReady) {
    try {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      const { data } = await supabase
        .from("hoteles")
        .select("nombre, ubicacion, fotos, habitaciones, extras")
        .eq("slug", slug)
        .eq("publicado", true)
        .maybeSingle();
      if (data) {
        nombre = data.nombre || nombre;
        ubicacion = data.ubicacion || null;
        foto = Array.isArray(data.fotos) ? data.fotos[0] || null : null;
        desde = precioDesde(Array.isArray(data.habitaciones) ? data.habitaciones : []);
        const extras = (data.extras ?? {}) as MiniExtras;
        color = extras.diseno?.color || COLOR_DEFAULT;
      }
    } catch {
      /* fallback: portada sin datos */
    }
  }

  const ink = inkFor(color);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          backgroundColor: color,
          fontFamily: "sans-serif",
        }}
      >
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={foto}
            alt=""
            width={OG_SIZE.width}
            height={OG_SIZE.height}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : null}
        {/* Gradiente para que el texto siempre sea legible sobre la foto.
            Ojo satori: sin `inset` (no lo soporta) y con width/height explícitos. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.45) 45%, rgba(0,0,0,0.12) 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            padding: "56px 64px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              backgroundColor: color,
              color: ink,
              fontSize: "24px",
              fontWeight: 700,
              padding: "10px 22px",
              borderRadius: "9999px",
              letterSpacing: "0.03em",
              textTransform: "uppercase",
            }}
          >
            Reserva directa · Confirmación inmediata
          </div>
          <div
            style={{
              display: "flex",
              fontSize: nombre.length > 26 ? "58px" : "72px",
              fontWeight: 800,
              color: "#FFFFFF",
              lineHeight: 1.05,
              letterSpacing: "-0.02em",
              maxWidth: "1050px",
            }}
          >
            {nombre}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              fontSize: "29px",
              color: "rgba(255,255,255,0.94)",
              fontWeight: 500,
            }}
          >
            {ubicacion ? (
              <div style={{ display: "flex" }}>
                📍 {ubicacion.length > 64 ? `${ubicacion.slice(0, 64)}…` : ubicacion}
              </div>
            ) : null}
            {desde ? (
              <div style={{ display: "flex" }}>
                Desde ${desde.toLocaleString("es-MX")} MXN por noche
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}
