import { CheckCircle2, XCircle } from "lucide-react";

const tools = [
  { name: "PMS básico", cost: "$1,200 MXN" },
  { name: "Motor de reservas", cost: "$800 MXN" },
  { name: "Agente de WhatsApp", cost: "$1,500 MXN" },
  { name: "Página web (mantenimiento)", cost: "$500 MXN" },
  { name: "Revenue management", cost: "$900 MXN" },
  { name: "Emails automáticos", cost: "$400 MXN" },
];

const koraFeatures = [
  "Página web + motor de reservas",
  "Agente WhatsApp con IA 24/7",
  "PMS completo (rooms, check-in/out)",
  "Agente de llamadas con IA",
  "Pricing dinámico con IA",
  "Dashboard + métricas en tiempo real",
  "Blog automático con IA",
  "Emails pre y post estancia",
  "Soporte en español",
  "CFDI 4.0 incluido",
];

export function ComparisonSection() {
  return (
    <section className="py-20 sm:py-24 bg-kora-primary">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3 text-center">
          ¿Cuánto pagas hoy por hacer todo esto por separado?
        </h2>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white/10 rounded-2xl p-6 border border-white/10">
            <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-5">
              Stack actual
            </p>
            <div className="space-y-3">
              {tools.map((tool) => (
                <div key={tool.name} className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <XCircle size={15} className="flex-shrink-0 text-red-400/70" aria-hidden="true" />
                    <span className="text-sm text-white/80">{tool.name}</span>
                  </div>
                  <span className="text-sm font-medium text-white whitespace-nowrap">{tool.cost}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-white/20 flex items-center justify-between gap-4">
              <span className="font-semibold text-white text-sm">Total mensual</span>
              <span className="font-bold text-lg text-red-300 whitespace-nowrap">$5,300 MXN/mes</span>
            </div>
          </div>

          <div className="bg-kora-accent rounded-2xl p-6">
            <p className="text-xs font-bold text-kora-primary/50 uppercase tracking-widest mb-5">
              Kora todo incluido
            </p>
            <div className="space-y-2.5">
              {koraFeatures.map((feature) => (
                <div key={feature} className="flex items-start gap-2">
                  <CheckCircle2
                    size={15}
                    className="flex-shrink-0 text-kora-primary/60 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-kora-primary/90">{feature}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 pt-4 border-t border-kora-primary/20 flex items-center justify-between gap-4">
              <span className="font-semibold text-kora-primary text-sm">Todo incluido</span>
              <span className="font-bold text-2xl text-kora-primary whitespace-nowrap">$2,990 MXN/mes</span>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-white/60 max-w-xl mx-auto leading-relaxed">
          Más el 18% que le pagas a Booking en cada reserva que Kora hubiera
          cerrado directo.
        </p>
      </div>
    </section>
  );
}
