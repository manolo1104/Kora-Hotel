import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { HerramientaIcono } from "@/components/herramientas/HerramientaIcono";
import { herramientas } from "@/lib/herramientas";

const destacadas = ["calculadora-comisiones", "calculadora-tarifa", "diagnostico", "respuestas-resenas"];
const featured = destacadas
  .map((slug) => herramientas.find((h) => h.slug === slug))
  .filter((h): h is NonNullable<typeof h> => Boolean(h));

const totalDisponibles = herramientas.filter((h) => h.disponible).length;

export function HerramientasSection() {
  return (
    <section className="py-16 sm:py-24 bg-kora-bg border-t border-gray-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="text-3xl sm:text-4xl font-bold text-kora-text tracking-tight text-center">
            Herramientas gratis para tu hotel
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-3 text-kora-muted text-center max-w-xl mx-auto leading-relaxed">
            Calculadoras y asistentes con IA para tomar mejores decisiones en tu
            hotel. Sin registro y sin costo.
          </p>
        </Reveal>

        {/* Herramientas destacadas (vista previa del catálogo) */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featured.map((h, i) => (
            <Reveal key={h.slug} delay={0.05 + i * 0.06}>
              <Link
                href={`/herramientas/${h.slug}`}
                className="card-hover group flex flex-col h-full bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:border-kora-accent transition-colors"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-10 h-10 rounded-xl bg-kora-primary/5 flex items-center justify-center text-kora-primary shrink-0">
                    <HerramientaIcono slug={h.slug} size={20} />
                  </span>
                  <span className="text-[10px] font-bold text-kora-accent bg-kora-accent/10 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                    {h.etiqueta}
                  </span>
                </div>
                <h3 className="text-base font-bold text-kora-text leading-snug">
                  {h.titulo}
                </h3>
                <p className="mt-1 text-sm text-kora-muted leading-relaxed flex-1">
                  {h.resumen}
                </p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary">
                  Usar gratis
                  <ArrowRight
                    size={14}
                    aria-hidden="true"
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/herramientas"
            className="btn-press inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border-2 border-kora-primary text-kora-primary font-semibold text-sm hover:bg-kora-primary hover:text-white transition-colors"
          >
            Ver las {totalDisponibles} herramientas
          </Link>
        </div>

        {/* Banda: mini-página gratis (wedge product-led) */}
        <Reveal>
          <div className="mt-12 rounded-2xl bg-kora-primary p-7 sm:p-9 flex flex-col sm:flex-row sm:items-center gap-6 sm:justify-between">
            <div>
              <h3 className="text-2xl font-bold text-white tracking-tight leading-tight">
                Crea tu página de reservas, gratis
              </h3>
              <p className="mt-2 text-white/75 text-sm sm:text-base leading-relaxed max-w-md">
                Una página de reservas directas por WhatsApp y una guía del huésped
                con QR. Sin comisiones y sin saber de tecnología.
              </p>
            </div>
            <Link
              href="/herramientas/mini-pagina"
              className="btn-press btn-arrow btn-fill shrink-0 inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-sm hover:bg-kora-accent-dark transition-colors"
            >
              Crear mi página gratis
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
