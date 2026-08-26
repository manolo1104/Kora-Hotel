"use client";

// El último recurso: se usa cuando falla el LAYOUT RAÍZ, así que es el único
// archivo de error que debe traer sus propios <html> y <body>. Tampoco puede
// contar con que Tailwind haya cargado — de ahí los estilos en línea.
//
// Un `error.tsx` normal NO captura los errores del layout de su mismo nivel; por
// eso este archivo hace falta además de `app/error.tsx`.

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#faf9f5",
          color: "#1e1e18",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "26rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: "0 0 12px" }}>
            Algo se rompió de nuestro lado.
          </h1>
          <p style={{ color: "#6b6b60", lineHeight: 1.6, margin: "0 0 24px" }}>
            No es tu conexión. Vuelve a intentarlo en un momento.
          </p>
          <button
            onClick={reset}
            style={{
              cursor: "pointer",
              border: "none",
              borderRadius: "999px",
              padding: "14px 28px",
              background: "#2d6a4f",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.875rem",
            }}
          >
            Reintentar
          </button>
        </div>
      </body>
    </html>
  );
}
