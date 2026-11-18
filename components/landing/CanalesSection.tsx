import Link from "next/link";
import { CalendarCheck, RefreshCw, ShieldCheck, Link2, ArrowLeftRight, ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { CANALES_OTA_DISPONIBLES } from "@/lib/panel/canales-ota";
import { ENLACE_OTA } from "@/lib/integraciones";

// «Enlaza tus OTAs» en la portada. Parte de la propuesta de valor desde el 18
// nov 2026: el hotelero pequeño no deja Airbnb ni Booking de un día para otro,
// y lo que más miedo le da de sumar un canal directo es vender dos veces el
// mismo cuarto. Esta sección contesta eso.
//
// Los límites (no es channel manager, iCal no mueve tarifas, cada OTA lee a su
// ritmo, Booking con condiciones, Expedia sólo vía Vrbo) van en la misma
// sección y con la misma redacción que el resto del sitio (`ENLACE_OTA`).
// Si `CANALES_OTA_DISPONIBLES` se apaga, la sección desaparece sola.

const OTAS = [
  { nombre: "Airbnb", logo: "/integraciones/airbnb.svg" },
  { nombre: "Booking.com", logo: "/integraciones/bookingdotcom.svg" },
  { nombre: "Expedia (Vrbo)", logo: "/integraciones/expedia.svg" },
];

const PASOS = [
  {
    Icon: Link2,
    titulo: "Pega el calendario de tu OTA",
    texto: "Copias el enlace iCal de cada anuncio de Airbnb, Booking o Vrbo y lo pegas en su habitación del panel.",
  },
  {
    Icon: ArrowLeftRight,
    titulo: "Pega el de Kora en tu OTA",
    texto: "Cada habitación tiene su enlace de Kora. Lo pegas en la OTA y ella cierra lo que vendes directo.",
  },
  {
    Icon: RefreshCw,
    titulo: "Kora bloquea sola",
    texto: "Justo antes de apartar cada reserva —en tu página o con Camila— Kora vuelve a leer tus OTAs y cierra esas noches.",
  },
];

const VALOR = [
  {
    Icon: CalendarCheck,
    titulo: "Un solo calendario",
    texto: "Tu página, Camila, el panel y tus OTAs miran la misma disponibilidad.",
  },
  {
    Icon: ShieldCheck,
    titulo: "Menos sobreventas",
    texto: "Si dos reservas llegan a chocar, te avisamos por correo al momento.",
  },
];

export function CanalesSection() {
  if (!CANALES_OTA_DISPONIBLES) return null;
  return (
    <section
      id="canales"
      aria-labelledby="canales-titulo"
      className="py-20 sm:py-24 bg-kora-bg text-kora-text scroll-mt-16 overflow-hidden"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-kora-primary/70 mb-3">
                Se enlaza con tus OTAs
              </p>
              <h2
                id="canales-titulo"
                className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight text-kora-text"
              >
                Sigue en Airbnb, Booking y Expedia. Sin vender dos veces el mismo cuarto.
              </h2>
              <p className="mt-4 text-kora-muted text-base sm:text-lg leading-relaxed">
                No tienes que elegir entre tu canal directo y las OTAs. Kora enlaza sus
                calendarios con el tuyo: lo que vendes allá se bloquea en Kora, y lo
                que vendes directo —sin comisión— se cierra allá.
              </p>

              <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {VALOR.map(({ Icon, titulo, texto }) => (
                  <li key={titulo} className="flex gap-3">
                    <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-kora-accent/20 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-kora-primary" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-semibold text-sm">{titulo}</p>
                      <p className="text-sm text-kora-muted leading-relaxed">{texto}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          {/* Diagrama: tres OTAs ⇄ el calendario de Kora. */}
          <Reveal delay={0.1}>
            <div className="relative rounded-3xl bg-kora-primary p-6 sm:p-8 shadow-xl">
              <ul className="grid grid-cols-3 gap-3" aria-label="OTAs que se enlazan con Kora">
                {OTAS.map((o) => (
                  <li
                    key={o.nombre}
                    className="flex flex-col items-center gap-2 rounded-2xl bg-white p-3 sm:p-4 text-center"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={o.logo} alt="" className="w-7 h-7 object-contain" aria-hidden="true" />
                    <span className="text-[11px] sm:text-xs font-semibold text-kora-text leading-tight">
                      {o.nombre}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="flex justify-center my-4" aria-hidden="true">
                <div className="flex items-center gap-2 rounded-full bg-kora-accent/15 px-3 py-1 text-[11px] font-semibold text-kora-accent">
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  iCal · en los dos sentidos
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 sm:p-5 text-kora-text">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold">Calendario de Kora</p>
                  <span className="text-[10px] font-semibold text-kora-primary bg-kora-accent/20 rounded-full px-2 py-0.5">
                    Un solo inventario
                  </span>
                </div>
                {/* Mini calendario ilustrativo: una semana de dos cabañas. */}
                <div className="grid grid-cols-[2.75rem_repeat(7,minmax(0,1fr))] gap-1 text-[10px]" aria-hidden="true">
                  <span />
                  {["L", "M", "M", "J", "V", "S", "D"].map((d, i) => (
                    <span key={i} className="text-center text-kora-muted font-semibold">{d}</span>
                  ))}
                  <span className="text-kora-muted font-semibold whitespace-nowrap">Cab. 1</span>
                  <span className="col-span-2 rounded bg-[#FF5A5F]/80 h-5" />
                  <span className="rounded bg-gray-100 h-5" />
                  <span className="col-span-3 rounded bg-kora-primary h-5" />
                  <span className="rounded bg-gray-100 h-5" />
                  <span className="text-kora-muted font-semibold whitespace-nowrap">Cab. 2</span>
                  <span className="rounded bg-gray-100 h-5" />
                  <span className="col-span-3 rounded bg-[#003580]/80 h-5" />
                  <span className="col-span-2 rounded bg-kora-accent h-5" />
                  <span className="rounded bg-gray-100 h-5" />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-kora-muted">
                  <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-[#FF5A5F]/80" />Airbnb</span>
                  <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-[#003580]/80" />Booking</span>
                  <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-kora-primary" />Directa</span>
                  <span className="flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-kora-accent" />Camila</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          <ol className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label="Cómo se enlaza una OTA">
            {PASOS.map(({ Icon, titulo, texto }, i) => (
              <li key={titulo} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
                <div className="flex items-center gap-3 mb-2">
                  <span className="w-7 h-7 rounded-full bg-kora-primary text-white text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <Icon className="w-4 h-4 text-kora-primary" aria-hidden="true" />
                </div>
                <p className="font-semibold text-sm sm:text-base">{titulo}</p>
                <p className="mt-1 text-sm text-kora-muted leading-relaxed">{texto}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-xs text-kora-muted leading-relaxed max-w-3xl">
            {ENLACE_OTA.limites} En Expedia, el iCal sólo existe para anuncios de Vrbo.
          </p>
          <Link
            href="/sincronizar-airbnb-booking"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-kora-primary underline decoration-kora-accent underline-offset-4"
          >
            Cómo se sincronizan Airbnb, Booking y Vrbo, paso a paso
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
