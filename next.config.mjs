// 🔴 El optimizador de imágenes de Next es un proxy: `/_next/image?url=…` va a
// buscar la imagen y la sirve DESDE kora-hotel.com. Con `*.supabase.co` como
// comodín, cualquiera podía pasarle la URL de CUALQUIER proyecto de Supabase del
// mundo y hacer que el dominio de Kora sirviera esa imagen — quemando de paso la
// cuota de transformaciones del plan Hobby (~5.000/mes), que es justo lo que el
// resto de esta configuración se esfuerza en cuidar.
//
// Se acota al proyecto real. Sale de la variable para que no se quede vieja si
// el proyecto cambia; el literal es sólo el respaldo de cuando no hay entorno
// (no es un secreto: NEXT_PUBLIC_SUPABASE_URL la ve el navegador).
const HOST_SUPABASE = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  } catch {
    return "dvequxrrvevmancnqmyu.supabase.co";
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Optimización de imágenes remotas (mini-páginas de hoteles en Supabase Storage) → mejor CWV/LCP.
  images: {
    remotePatterns: [{ protocol: "https", hostname: HOST_SUPABASE }],
    // Servir WebP/AVIF. Cache larga (31 días) para NO regenerar la misma foto una
    // y otra vez, y un juego ACOTADO de tamaños para limitar el nº de
    // transformaciones (protege la cuota de Vercel Hobby ~5k/mes).
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2678400,
    deviceSizes: [360, 640, 828, 1080, 1200],
    imageSizes: [56, 96, 200],
  },

  // 301 de los hosts duplicados → dominio canónico (evita contenido duplicado en SEO).
  // Solo afecta los alias de producción; las URLs de preview (con hash de rama) no se tocan.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "kora-hotel.vercel.app" }],
        destination: "https://kora-hotel.com/:path*",
        permanent: true,
      },
      {
        // `www` servía el sitio ENTERO con 200, no redirigía. El canonical de
        // cada página apunta al apex y eso evitó lo peor, pero al 4 sep 2026
        // Google ya tenía indexadas URLs bajo `www.kora-hotel.com` — dos
        // direcciones para la misma página, repartiéndose la autoridad. El 301
        // deja una sola puerta.
        source: "/:path*",
        has: [{ type: "host", value: "www.kora-hotel.com" }],
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
      {
        // Venía de `vercel.json`, que era el ÚLTIMO bloque de cabeceras que
        // quedaba fuera de aquí. No es de seguridad —es caché del sitemap— pero
        // dejarlo allí mantenía vivo el problema que la etapa 9.4 cerró: dos
        // sitios donde mirar, y uno de los dos invisible en `npm run dev`.
        source: "/sitemap.xml",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

export default nextConfig;
