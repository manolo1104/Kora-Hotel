import { CheckCircle2 } from "lucide-react";

const features = [
  "Página web con motor de reservas directo",
  "Agente WhatsApp con IA (24/7)",
  "PMS completo: habitaciones, check-in, check-out, housekeeping",
  "Agente de llamadas con IA en español",
  "Pricing dinámico con IA",
  "Dashboard + métricas + forecast 30 días",
  "Blog automático con IA",
  "Emails automáticos pre y post estancia",
  "CRM de huéspedes",
  "Soporte en español por WhatsApp",
  "CFDI 4.0 integrado con el SAT",
  "Setup gratis (primeros 10 hoteles)",
];

export function PricingSection() {
  return (
    <section id="precios" className="py-20 sm:py-24 bg-kora-bg">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text mb-2">
          Precio de fundador
        </h2>
        <p className="text-kora-muted mb-12">Solo para los primeros 10 hoteles</p>

        <div className="relative bg-white rounded-3xl p-8 sm:p-10 border-2 border-kora-primary/20 shadow-xl shadow-kora-primary/5">
          <div className="absolute -top-4 left-1/2 -translate-x-1/2">
            <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-kora-accent text-kora-primary text-xs font-bold whitespace-nowrap">
              Primeros 10 hoteles · Setup incluido gratis
            </span>
          </div>

          <div className="mt-2">
            <p className="text-kora-muted text-sm font-medium">Kora Completo</p>

            <div className="mt-3 flex items-baseline justify-center gap-2">
              <span className="text-5xl font-bold text-kora-primary">$2,990</span>
              <span className="text-lg text-kora-muted">MXN/mes</span>
            </div>
            <p className="mt-1.5">
              <span className="text-kora-muted text-sm line-through">$4,500 MXN/mes</span>
            </p>

            <ul className="mt-8 space-y-3 text-left max-w-sm mx-auto" aria-label="Características incluidas">
              {features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <CheckCircle2
                    size={18}
                    className="flex-shrink-0 text-kora-accent mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-kora-text">{feature}</span>
                </li>
              ))}
            </ul>

            <a
              href="#contacto"
              className="mt-8 block w-full py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-base hover:bg-kora-accent-dark transition-colors text-center"
            >
              Quiero ser hotel fundador
            </a>

            <p className="mt-4 text-xs text-kora-muted">
              Sin contrato anual. Cancela cuando quieras.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
