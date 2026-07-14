import { Check, FileCheck, ShieldCheck, Lock } from "lucide-react";

// Franja de confianza con datos 100% reales (nada inventado).
const items = [
  "Hecho por un hotelero, no por una software house",
  "Ahorra hasta $12,000 MXN/mes en comisiones de OTAs",
  "Respuesta en segundos por WhatsApp",
  "CFDI 4.0 con el SAT",
  "Te quedas con el 100% del pago",
  "Todo en español",
];

// Certificaciones y cumplimiento REALES (sin logos oficiales que no nos
// corresponden): cada claim es verificable tal cual está escrito.
const certificaciones = [
  {
    Icon: FileCheck,
    texto: "Facturación CFDI 4.0 conforme al SAT, vía PAC autorizado",
  },
  {
    Icon: ShieldCheck,
    texto: "Pagos procesados por Stripe · certificación PCI DSS Nivel 1",
  },
  {
    Icon: Lock,
    texto: "Cifrado SSL/TLS en todo el sitio",
  },
  {
    Icon: null,
    texto: "🇲🇽 Empresa 100% mexicana",
  },
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

        <ul
          className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-center gap-x-7 gap-y-2"
          aria-label="Cumplimiento y seguridad"
        >
          {certificaciones.map(({ Icon, texto }) => (
            <li key={texto} className="flex items-center gap-1.5">
              {Icon && (
                <Icon size={13} className="text-kora-primary flex-shrink-0" aria-hidden="true" />
              )}
              <span className="text-[11px] text-kora-muted whitespace-nowrap">{texto}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
