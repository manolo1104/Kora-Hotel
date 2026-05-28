import { ImageResponse } from "next/og";

// Imagen que se muestra al compartir el sitio en WhatsApp, Facebook, X, etc.
// Se genera automáticamente con la marca de Kora (1200×630).
export const alt =
  "Kora — Sistema hotelero con IA para hoteles boutique en México";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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

        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div
            style={{
              fontSize: "72px",
              fontWeight: 800,
              color: "#FAFAF8",
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              maxWidth: "900px",
            }}
          >
            Tu hotel lleno. Sin depender de Booking.
          </div>
          <div
            style={{
              fontSize: "32px",
              color: "#52B788",
              fontWeight: 500,
              lineHeight: 1.3,
              maxWidth: "880px",
            }}
          >
            Sistema hotelero con IA para hoteles boutique en México. Reservas
            directas, WhatsApp 24/7 y PMS. Todo en español.
          </div>
        </div>

        <div style={{ fontSize: "26px", color: "#FAFAF8", opacity: 0.7 }}>
          korahotel.mx
        </div>
      </div>
    ),
    { ...size }
  );
}
