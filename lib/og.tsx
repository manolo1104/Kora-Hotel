import { ImageResponse } from "next/og";

// Generador único de imágenes Open Graph (1200×630) con la marca de Kora.
// Lo usan el OG global y las páginas clave (precios, herramientas, mini-página).
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export function koraOG({
  title,
  subtitle,
  eyebrow,
}: {
  title: string;
  subtitle: string;
  eyebrow?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#1B4332",
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Marca */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "9999px",
              backgroundColor: "#52B788",
            }}
          />
          <div
            style={{
              fontSize: "44px",
              fontWeight: 800,
              color: "#FAFAF8",
              letterSpacing: "-0.02em",
            }}
          >
            Kora
          </div>
        </div>

        {/* Texto */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {eyebrow ? (
            <div
              style={{
                display: "flex",
                fontSize: "26px",
                color: "#52B788",
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {eyebrow}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              fontSize: "70px",
              fontWeight: 800,
              color: "#FAFAF8",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              maxWidth: "920px",
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "32px",
              color: "#52B788",
              fontWeight: 500,
              lineHeight: 1.3,
              maxWidth: "880px",
            }}
          >
            {subtitle}
          </div>
        </div>

        {/* Pie */}
        <div style={{ display: "flex", fontSize: "26px", color: "#FAFAF8", opacity: 0.7 }}>
          kora-hotel.com
        </div>
      </div>
    ),
    { ...OG_SIZE }
  );
}
