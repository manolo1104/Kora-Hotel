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

  // Cabeceras seguras y neutrales para SEO. NO se usa X-Frame-Options para no romper
  // el motor de reservas embebible en los sitios de los hoteles.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
