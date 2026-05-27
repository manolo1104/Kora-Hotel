import { Check } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";

const benefits = [
  "Implementación gratis (valor $5,000 MXN)",
  "Precio especial $2,990 MXN/mes de por vida",
  "Acceso prioritario a nuevas funciones",
  "Soporte directo con el equipo fundador",
];

export function ContactForm() {
  return (
    <section id="contacto" className="py-20 sm:py-24 bg-kora-primary">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

          <Reveal>
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
                Sé uno de los 10 hoteles fundadores
              </h2>
              <p className="mt-4 text-kora-accent text-base leading-relaxed">
                Implementación gratis + precio especial de por vida + acceso
                prioritario a nuevas funciones
              </p>

              <ul className="mt-8 space-y-4" aria-label="Beneficios del programa fundador">
                {benefits.map((benefit, i) => (
                  <Reveal key={benefit} delay={0.15 + i * 0.08}>
                    <li className="flex items-start gap-3">
                      <div
                        className="w-5 h-5 rounded-full bg-kora-accent flex items-center justify-center flex-shrink-0 mt-0.5"
                        aria-hidden="true"
                      >
                        <Check size={11} className="text-kora-primary" />
                      </div>
                      <span className="text-white/90 text-sm">{benefit}</span>
                    </li>
                  </Reveal>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="bg-white rounded-2xl p-6 sm:p-8">
              <form
                action={process.env.NEXT_PUBLIC_FORMSPREE_URL ?? ""}
                method="POST"
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="hotel"
                    className="block text-sm font-semibold text-kora-text mb-1.5"
                  >
                    Nombre del hotel
                  </label>
                  <input
                    id="hotel"
                    name="hotel"
                    type="text"
                    required
                    placeholder="Hotel Paraíso Encantado"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200"
                  />
                </div>

                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-semibold text-kora-text mb-1.5"
                  >
                    Tu nombre
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    placeholder="Manolo Covarrubias"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200"
                  />
                </div>

                <div>
                  <label
                    htmlFor="whatsapp"
                    className="block text-sm font-semibold text-kora-text mb-1.5"
                  >
                    WhatsApp
                  </label>
                  <input
                    id="whatsapp"
                    name="whatsapp"
                    type="tel"
                    required
                    placeholder="+52 489 123 4567"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200"
                  />
                </div>

                <div>
                  <label
                    htmlFor="rooms"
                    className="block text-sm font-semibold text-kora-text mb-1.5"
                  >
                    Número de habitaciones
                  </label>
                  <select
                    id="rooms"
                    name="rooms"
                    required
                    defaultValue=""
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200 bg-white"
                  >
                    <option value="" disabled>
                      Selecciona...
                    </option>
                    <option value="5-10">5 a 10 habitaciones</option>
                    <option value="11-20">11 a 20 habitaciones</option>
                    <option value="21-40">21 a 40 habitaciones</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="location"
                    className="block text-sm font-semibold text-kora-text mb-1.5"
                  >
                    ¿Dónde está tu hotel?
                  </label>
                  <input
                    id="location"
                    name="location"
                    type="text"
                    required
                    placeholder="Xilitla, San Luis Potosí"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-kora-text text-sm placeholder:text-kora-muted focus:outline-none focus:ring-2 focus:ring-kora-accent focus:border-transparent transition-all duration-200"
                  />
                </div>

                <button
                  type="submit"
                  className="btn-press w-full py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-base hover:bg-kora-accent-dark transition-colors mt-2"
                >
                  Solicitar mi lugar
                </button>
              </form>

              <p className="mt-5 text-xs text-kora-muted text-center leading-relaxed">
                Te contactamos por WhatsApp en menos de 24 horas.
                <br />
                Sin llamadas en frío. Sin vendedores.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
