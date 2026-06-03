import { Reveal } from "@/components/shared/Reveal";
import { CountUp } from "@/components/shared/CountUp";

// ─── Reemplaza con la URL de tu foto cuando la tengas ────────────────────────
// Ejemplo: "https://tu-dominio.com/fotos/manolo.jpg"
// O sube la foto a /public/manolo.jpg y pon: "/manolo.jpg"
const FOTO_MANOLO = "/manolo.jpg";

// Sitios reales que hemos creado (prueba del servicio de página a la medida).
// Cuando tengas el link de Refacciones Franco, ponlo en su "url".
const sitiosCreados = [
  {
    logo: "/portfolio/paraiso-encantado.png",
    nombre: "Hotel Paraíso Encantado",
    url: "https://paraisoencantado.com",
  },
  {
    logo: "/portfolio/huasteca-tours.png",
    nombre: "Huasteca Potosina Tours",
    url: "https://www.huasteca-potosina.com",
  },
  {
    logo: "/portfolio/papan-huasteco.png",
    nombre: "El Papán Huasteco",
    url: "https://papan-huasteco.vercel.app",
  },
  {
    logo: "/portfolio/refacciones-franco.png",
    nombre: "Refacciones Franco",
    url: "https://refacciones-franco.vercel.app",
  },
];

// Cifras verificables (no estimaciones): comisión 0% en reservas directas,
// respuesta del agente de IA en segundos, y el costo real de un stack de apps
// separadas (~$5,300/mes) frente a Kora (desde $1,990 todo incluido).
const metrics = [
  {
    value: "0%",
    label: "Comisión en tus reservas directas",
  },
  {
    value: "Segundos",
    label: "Respuesta en WhatsApp con IA (antes: horas)",
  },
  {
    countTo: 5300,
    prefix: "$",
    suffix: "",
    label: "MXN/mes en apps separadas (vs desde $1,990 con Kora)",
  },
] as const;

export function SocialProofSection() {
  return (
    <section className="py-20 sm:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text mb-12">
            Funcionando en producción
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Reveal delay={0.08} className="lg:col-span-2">
            <div className="bg-kora-bg rounded-2xl p-8 border border-gray-100 h-full">
              <blockquote>
                <p className="text-lg sm:text-xl text-kora-text leading-relaxed">
                  &ldquo;Diseñé Kora para mi propio hotel porque no encontré nada
                  que realmente funcionara para hoteles como el nuestro.&rdquo;
                </p>
                <footer className="mt-7 flex items-center gap-4">
                  {FOTO_MANOLO ? (
                    <img
                      src={FOTO_MANOLO}
                      alt="Manolo Covarrubias"
                      className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-full bg-kora-primary flex items-center justify-center flex-shrink-0"
                      aria-hidden="true"
                    >
                      <span className="text-white font-bold text-base">MC</span>
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-kora-text">Manolo Covarrubias</p>
                    <p className="text-sm text-kora-muted">
                      Fundador de Kora · Propietario del Hotel Paraíso Encantado
                    </p>
                    <p className="text-sm text-kora-muted">Xilitla, San Luis Potosí</p>
                  </div>
                </footer>
              </blockquote>
            </div>
          </Reveal>

          <div className="space-y-4">
            {metrics.map((metric, i) => (
              <Reveal key={i} delay={0.12 + i * 0.08}>
                <div className="bg-kora-bg rounded-2xl p-5 border border-gray-100">
                  {"countTo" in metric ? (
                    <CountUp
                      to={metric.countTo}
                      prefix={metric.prefix}
                      suffix={metric.suffix}
                      className="text-3xl font-bold text-kora-primary block"
                    />
                  ) : (
                    <p className="text-3xl font-bold text-kora-primary">{metric.value}</p>
                  )}
                  <p className="text-sm text-kora-muted mt-1 leading-snug">{metric.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        {/* Sitios que hemos creado — prueba del servicio de página a la medida */}
        <Reveal delay={0.1}>
          <div className="mt-14 pt-12 border-t border-gray-100">
            <p className="text-center text-sm font-semibold text-kora-muted uppercase tracking-widest">
              Sitios reales que hemos creado
            </p>
            <p className="mt-2 text-center text-kora-muted text-sm max-w-xl mx-auto">
              Páginas profesionales que diseñamos y publicamos para negocios reales.
              Si eres de los primeros 10 hoteles,{" "}
              <span className="font-semibold text-kora-primary">
                la tuya va incluida gratis
              </span>
              .
            </p>
            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {sitiosCreados.map((s) => {
                const inner = (
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm h-28 flex items-center justify-center p-5 transition-all duration-300 group-hover:shadow-md group-hover:-translate-y-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={s.logo}
                      alt={s.nombre}
                      className="max-h-16 max-w-full w-auto object-contain"
                    />
                  </div>
                );
                return s.url ? (
                  <a
                    key={s.nombre}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Ver el sitio de ${s.nombre}`}
                    className="group block"
                  >
                    {inner}
                    <p className="mt-2 text-center text-xs text-kora-muted group-hover:text-kora-primary transition-colors">
                      {s.nombre}
                    </p>
                  </a>
                ) : (
                  <div key={s.nombre} className="group block">
                    {inner}
                    <p className="mt-2 text-center text-xs text-kora-muted">
                      {s.nombre}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
