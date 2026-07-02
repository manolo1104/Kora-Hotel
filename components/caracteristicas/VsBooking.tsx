import { Check, X, ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";

// Comparativa honesta: reserva directa con el motor de Kora vs vender por
// Booking. No demoniza a las OTAs (dan visibilidad); el punto es a dónde debe
// caer la SEGUNDA reserva de cada huésped.

const FILAS = [
  {
    concepto: "Comisión por reserva",
    kora: "0% — cada reserva es 100% tuya",
    booking: "15–20% de cada reserva",
  },
  {
    concepto: "El dinero",
    kora: "Directo a tu cuenta, con tarjeta, OXXO o pago al llegar",
    booking: "Lo cobra Booking y te lo deposita después",
  },
  {
    concepto: "Los datos del huésped",
    kora: "Correo y teléfono a tu CRM, para volverle a vender",
    booking: "Los oculta: el huésped es de Booking",
  },
  {
    concepto: "Tu marca",
    kora: "Tu logo, tus colores, en tu propia web",
    booking: "La marca y el diseño de Booking",
  },
  {
    concepto: "Las reglas",
    kora: "Tú decides anticipo, cancelación y tarifa no reembolsable",
    booking: "Sus políticas y sus sanciones",
  },
  {
    concepto: "Después de la estancia",
    kora: "Emails automáticos: encuesta, reseña y oferta de regreso",
    booking: "Booking le ofrece “hoteles similares” al tuyo",
  },
  {
    concepto: "Costo",
    kora: "Mensualidad fija, sin sorpresas",
    booking: "Comisión que crece junto con tus ventas",
  },
];

export function VsBooking() {
  return (
    <section id="vs-booking" className="py-16 sm:py-20 bg-kora-bg scroll-mt-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="text-center mb-10">
            <p className="text-xs font-bold text-kora-muted uppercase tracking-widest mb-2">
              Reserva directa vs OTA
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text">
              La misma reserva, dos destinos muy distintos
            </h2>
            <p className="mt-3 text-kora-muted text-base max-w-2xl mx-auto leading-relaxed">
              Booking sirve para que te descubran. Pero cuando el huésped que ya
              te conoce vuelve a reservar por Booking, regalas la comisión — y
              al huésped.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th scope="col" className="px-4 py-4 sm:px-6 text-xs font-bold uppercase tracking-widest text-kora-muted w-[26%]">
                    &nbsp;
                  </th>
                  <th scope="col" className="px-4 py-4 sm:px-6 bg-kora-primary/[0.04]">
                    <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-kora-primary">
                      <Check size={15} aria-hidden="true" /> Directa con Kora
                    </span>
                  </th>
                  <th scope="col" className="px-4 py-4 sm:px-6">
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-kora-muted">
                      <X size={15} aria-hidden="true" /> Por Booking
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {FILAS.map((f, i) => (
                  <tr key={f.concepto} className={i < FILAS.length - 1 ? "border-b border-gray-50" : ""}>
                    <th scope="row" className="px-4 py-3.5 sm:px-6 align-top text-xs sm:text-sm font-bold text-kora-text">
                      {f.concepto}
                    </th>
                    <td className="px-4 py-3.5 sm:px-6 align-top text-xs sm:text-sm text-kora-text leading-snug bg-kora-primary/[0.04] font-medium">
                      {f.kora}
                    </td>
                    <td className="px-4 py-3.5 sm:px-6 align-top text-xs sm:text-sm text-kora-muted leading-snug">
                      {f.booking}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Reveal>

        <Reveal delay={0.16}>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/#demo-motor"
              className="btn-press btn-arrow btn-fill inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-kora-accent text-kora-primary font-semibold text-sm hover:bg-kora-accent-dark transition-colors"
            >
              Probar el motor en vivo
              <ArrowRight size={16} aria-hidden="true" />
            </a>
            <a
              href="/herramientas/calculadora-comisiones"
              className="text-sm font-semibold text-kora-primary underline hover:text-kora-primary-dark transition-colors"
            >
              Calcula cuánto le regalas a Booking al año
            </a>
          </div>
          <p className="mt-5 text-center text-xs text-kora-muted max-w-xl mx-auto leading-relaxed">
            Para ser justos: las OTAs te ponen frente a millones de viajeros y no
            hace falta dejarlas. La jugada es que te descubran ahí una vez — y que
            cada reserva siguiente sea directa.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
