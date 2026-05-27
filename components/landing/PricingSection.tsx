import { CheckCircle2, XCircle } from "lucide-react";

// Actualizar manualmente cuando cambien los lugares disponibles
const LUGARES_DISPONIBLES = 7;

const featuresCompleto = [
  "Motor de reservas directo sin comisiones",
  "Agente WhatsApp con IA (24/7)",
  "PMS completo: habitaciones, check-in, check-out, housekeeping",
  "Agente de llamadas con IA en español",
  "Pricing dinámico con IA",
  "Dashboard + métricas + forecast 30 días",
  "Blog automático con IA",
  "Emails automáticos pre y post estancia",
  "CRM de huéspedes",
  "CFDI 4.0 integrado con el SAT",
  "API REST para integraciones",
  "Setup gratis + capacitación incluida",
];

const featuresEsencial = [
  "Motor de reservas directo",
  "PMS básico (habitaciones + check-in/out)",
  "CFDI 4.0",
  "Soporte por email",
];

const featuresEsencialNO = [
  "Agente WhatsApp con IA",
  "Agente de llamadas con IA",
  "Pricing dinámico",
  "Dashboard y métricas avanzadas",
];

export function PricingSection() {
  return (
    <section id="precios" className="py-20 sm:py-24 bg-kora-bg">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text mb-2">
            Precio de fundador
          </h2>
          <p className="text-kora-muted">
            Solo para los primeros 10 hoteles. Quedan{" "}
            <span className="font-bold text-kora-primary">
              {LUGARES_DISPONIBLES} lugares
            </span>
            .
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {/* Plan ancla — Esencial */}
          <div className="card-hover bg-white rounded-3xl p-8 border border-gray-200">
            <p className="text-sm font-bold text-kora-muted mb-1">
              Kora Esencial
            </p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-bold text-kora-text">$2,490</span>
              <span className="text-kora-muted">MXN/mes</span>
            </div>
            <p className="text-xs text-kora-muted mt-1">Solo funciones básicas</p>

            <ul className="mt-6 space-y-2.5">
              {featuresEsencial.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <CheckCircle2
                    size={16}
                    className="flex-shrink-0 text-kora-accent mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-kora-text">{f}</span>
                </li>
              ))}
              {featuresEsencialNO.map((f) => (
                <li key={f} className="flex items-start gap-2.5 opacity-40">
                  <XCircle
                    size={16}
                    className="flex-shrink-0 text-kora-muted mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-kora-muted line-through">{f}</span>
                </li>
              ))}
            </ul>

            <a
              href="#contacto"
              className="btn-press mt-8 block w-full py-3.5 rounded-full border-2 border-gray-200 text-kora-muted font-semibold text-sm hover:border-kora-primary hover:text-kora-primary transition-colors text-center"
            >
              Empezar con Esencial
            </a>
          </div>

          {/* Plan fundador — Completo */}
          <div className="relative bg-white rounded-3xl p-8 border-2 border-kora-primary shadow-xl shadow-kora-primary/5">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-kora-accent text-kora-primary text-xs font-bold whitespace-nowrap">
                Recomendado · Setup gratis
              </span>
            </div>

            <p className="text-sm font-bold text-kora-primary mb-1 mt-1">
              Kora Completo Fundador
            </p>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-4xl font-bold text-kora-primary">$2,990</span>
              <span className="text-kora-muted">MXN/mes</span>
            </div>
            <p className="mt-1">
              <span className="text-kora-muted text-sm line-through">
                $4,500 MXN/mes
              </span>
              <span className="ml-2 text-xs font-bold text-kora-accent">
                Ahorra $1,510/mes
              </span>
            </p>

            <ul
              className="mt-6 space-y-2.5"
              aria-label="Características incluidas"
            >
              {featuresCompleto.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5">
                  <CheckCircle2
                    size={16}
                    className="flex-shrink-0 text-kora-accent mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-kora-text">{feature}</span>
                </li>
              ))}
            </ul>

            <a
              href="#contacto"
              className="btn-press mt-8 block w-full py-4 rounded-full bg-kora-accent text-kora-primary font-bold text-base hover:bg-kora-accent-dark transition-colors text-center"
            >
              Quiero ser hotel fundador
            </a>

            <p className="mt-4 text-xs text-kora-muted text-center">
              Sin contrato anual. Cancela cuando quieras.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
