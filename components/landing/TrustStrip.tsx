import { Check } from "lucide-react";

// Franja de confianza con datos 100% reales (nada inventado).
const items = [
  "0% comisión en reservas directas",
  "Respuesta en segundos por WhatsApp",
  "CFDI 4.0 con el SAT",
  "Te quedas con el 100% del pago",
  "Todo en español",
];

export function TrustStrip() {
  return (
    <section className="bg-white border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:gap-x-8">
          {items.map((t) => (
            <li key={t} className="flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-kora-accent/20 flex items-center justify-center flex-shrink-0">
                <Check size={11} className="text-kora-primary" />
              </span>
              <span className="text-xs sm:text-sm font-medium text-kora-text whitespace-nowrap">
                {t}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
