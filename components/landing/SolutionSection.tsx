import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { CtaLink } from "@/components/shared/CtaLink";
import { ProductTour } from "@/components/landing/ProductTour";
import { GARANTIA, PASOS_ALTA, PRECIO_DESDE, RUTA_REGISTRO } from "@/lib/oferta";

// «Cómo empezar» en la portada. Hasta el 15 sep 2026 el paso 1 era «Te montamos
// tu hotel en 24 h · Tú no tocas nada técnico», que contradecía el alta real
// (por cuenta propia, desde el registro) y una promesa que Manolo ya no hace.
//
// Ahora sale de `PASOS_ALTA`, la misma fuente que /como-funciona. Aquí caben
// tres, y son los tres primeros: crear la cuenta, cargar el hotel y probarlo por
// dentro, que es justo lo que la portada tiene que dejar claro. Activar el plan
// ya lo cuentan la línea del precio de abajo y la sección de precios.
//
// Se toman POR POSICIÓN y con su número real a propósito. La primera versión
// elegía «el paso de probar» con `/prueb/i` sobre el título, pero el título es
// «Pruébalo», con tilde, así que la búsqueda nunca acertaba: caía en «Carga tu
// hotel» y la portada enseñaba 1-2-5 numerados como 1-2-3, sin el paso de probar
// y con números que no cuadraban con /como-funciona#paso-N. Los textos NO se
// reescriben: si cambia un paso, cambia aquí también.
const RESUMEN_ALTA = PASOS_ALTA.slice(0, 3);

export function SolutionSection() {
  return (
    <section id="caracteristicas" className="py-20 sm:py-24 bg-kora-bg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-kora-primary/70 mb-3">
              Todo en un solo lugar
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text">
              Todo tu hotel en una sola pantalla
            </h2>
            <p className="mt-4 text-kora-muted text-base sm:text-lg leading-relaxed">
              Reemplaza tu mezcla de herramientas sueltas. Sigue bajando y mira
              cada pieza funcionando.
            </p>
          </div>
        </Reveal>

        {/* Plan de pasos (StoryBrand: la guía le da un plan claro al héroe) */}
        <Reveal delay={0.1}>
          <div className="mb-14">
            <ol
              className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5"
              aria-label="Cómo empezar con Kora"
            >
              {RESUMEN_ALTA.map((p, i) => (
                <li key={p.titulo} className="flex gap-4 p-5 rounded-2xl border border-gray-100 bg-white shadow-sm">
                  <span className="flex-shrink-0 w-9 h-9 rounded-full bg-kora-primary text-white font-bold text-sm flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold text-kora-text text-sm sm:text-base">{p.titulo}</p>
                    <p className="mt-1 text-xs sm:text-sm text-kora-muted leading-relaxed">{p.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
              <CtaLink
                href={RUTA_REGISTRO}
                ctaName="solucion_onboarding"
                className="btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-semibold text-sm hover:bg-kora-accent-dark transition-colors"
              >
                Crear mi cuenta gratis
                <ArrowRight size={16} aria-hidden="true" />
              </CtaLink>
              <Link
                href="/como-funciona"
                className="btn-arrow inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary hover:text-kora-primary-dark transition-colors"
              >
                Ver los {PASOS_ALTA.length} pasos y qué puedes probar
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-2 text-xs text-kora-muted">
              {GARANTIA.diasPrueba} días gratis, sin tarjeta. Lo configuras tú y te
              ayudamos si quieres.
            </p>
          </div>
        </Reveal>

        <ProductTour />

        <Reveal delay={0.2}>
          <p className="mt-10 text-xs text-kora-muted">
            Un solo plan de ${PRECIO_DESDE.toLocaleString("es-MX")} MXN/mes, todo
            incluido y con habitaciones ilimitadas: motor de reservas, PMS, Camila
            (WhatsApp con IA, 24/7), dashboard y CRM.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
