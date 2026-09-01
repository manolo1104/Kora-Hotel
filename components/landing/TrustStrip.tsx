import { Check, ShieldCheck, Lock } from "lucide-react";
import { AHORRO_MENSUAL, CASO, mxn } from "@/lib/caso-paraiso";

// Franja de confianza con datos 100% reales (nada inventado).
//
// Decía "Ahorra hasta $12,000 MXN/mes", que era justo el único dato de la
// franja que NO era real: una proyección, en una lista que presume de no
// tenerlas, y encima por encima de lo que Kora puede demostrar. El caso publica
// $8,400 en un hotel de verdad. Citar el dato medido es más fuerte que citar un
// techo: un "hasta" cualquiera lo descarta, un hotel con nombre no.
const items = [
  "Hecho por un hotelero, no por una software house",
  `${mxn(AHORRO_MENSUAL)} MXN/mes menos en comisiones — medido en el ${CASO.hotel}`,
  "Respuesta en segundos por WhatsApp",
  "Te quedas con el 100% del pago",
  "Todo en español",
];

// Certificaciones y cumplimiento REALES (sin logos oficiales que no nos
// corresponden): cada claim es verificable tal cual está escrito.
const certificaciones = [
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
