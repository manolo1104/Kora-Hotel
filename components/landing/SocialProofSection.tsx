import { Reveal } from "@/components/shared/Reveal";
import { CountUp } from "@/components/shared/CountUp";

// ─── Reemplaza con la URL de tu foto cuando la tengas ────────────────────────
// Ejemplo: "https://tu-dominio.com/fotos/manolo.jpg"
// O sube la foto a /public/manolo.jpg y pon: "/manolo.jpg"
const FOTO_MANOLO = "";

const metrics = [
  {
    countTo: 40,
    prefix: "+",
    suffix: "%",
    label: "Reservas directas vs OTAs",
  },
  {
    value: "Segundos",
    label: "Tiempo de respuesta en WhatsApp (antes: horas)",
  },
  {
    countTo: 8400,
    prefix: "$",
    suffix: "",
    label: "MXN/mes en comisiones ahorradas (promedio)",
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
      </div>
    </section>
  );
}
