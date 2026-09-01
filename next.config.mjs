/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimización de imágenes remotas (mini-páginas de hoteles en Supabase Storage) → mejor CWV/LCP.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
    // Servir WebP/AVIF. Cache larga (31 días) para NO regenerar la misma foto una
    // y otra vez, y un juego ACOTADO de tamaños para limitar el nº de
    // transformaciones (protege la cuota de Vercel Hobby ~5k/mes).
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    deviceSizes: [360, 640, 828, 1080, 1200],
    imageSizes: [56, 96, 200],
  },

  // 301 del dominio de Vercel duplicado → dominio canónico (evita contenido duplicado en SEO).
  // Solo afecta el alias de producción; las URLs de preview (con hash de rama) no se tocan.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "kora-hotel.vercel.app" }],
        destination: "https://kora-hotel.com/:path*",
        permanent: true,
      },
    ];
  },

  // ─── Cabeceras de seguridad · ÚNICO SITIO ────────────────────────────────
  //
  // Estaban repartidas entre AQUÍ y `vercel.json`, y el comentario de este
  // archivo llegó a decir "NO se usa X-Frame-Options" mientras `vercel.json` sí
  // lo mandaba. Dos sitios para lo mismo se desincronizan; y el de `vercel.json`
  // además no existe en `npm run dev`, así que lo que se probaba en local no era
  // lo que se servía en producción. Ahora todo vive aquí y vale en los dos.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Kora no usa cámara, micrófono ni ubicación. Declararlo cierra esas
          // puertas para cualquier script de terceros que entre por un iframe.
          // `payment` NO se apaga: hoy el cobro es Stripe Checkout alojado
          // (redirección), pero el día que se incruste, apagarlo lo rompería.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
      {
        // Todo MENOS los sitios de los hoteles: no se deja meter en un iframe.
        // Lo que hay detrás de esta puerta es el panel del hotelero y el CRM del
        // fundador: sin esto, cualquier página podía enmarcarlos y hacer que un
        // clic cayera donde no se veía.
        source: "/((?!h/).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
      {
        // `/h/*` SÍ se embebe, y es a propósito: el motor de reservas vive
        // dentro de la página del hotel. `frame-ancestors *` en vez de no mandar
        // nada, para que quede escrito que es una decisión y no un olvido.
        source: "/h/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
    ];
  },
};

export default nextConfig;
