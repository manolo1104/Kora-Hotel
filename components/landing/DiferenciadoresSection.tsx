import { UserCheck, Languages, Receipt, LifeBuoy, Percent } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { FUNDADOR } from "@/lib/fundador";

type Tile = {
  Icon: typeof UserCheck;
  titulo: string;
  desc: string;
  style: "dark" | "accent" | "light";
  span: string;
  founder?: boolean;
};

// Bento: un mosaico grande de protagonista (el fundador hotelero) + el resto
// en tamaños variados, estilo Stripe/Notion.
const tiles: Tile[] = [
  {
    Icon: UserCheck,
    titulo: "Hecho por un hotelero, no por una software house",
    desc: "Kora lo construye alguien que vive de un hotel y conoce el dolor de cada reserva perdida. No es un software genérico adaptado a la fuerza.",
    style: "dark",
    span: "sm:col-span-2 lg:col-span-2 lg:row-span-2",
    founder: true,
  },
  {
    Icon: Percent,
    titulo: "0% comisión en reservas directas",
    desc: "Cada reserva directa es 100% tuya. Booking ya no se lleva su tajada.",
    style: "accent",
    span: "",
  },
  {
    Icon: Languages,
    titulo: "100% en español",
    desc: "El sistema, el soporte y la IA, todo en tu idioma.",
    style: "light",
    span: "",
  },
  {
    Icon: Receipt,
    titulo: "CFDI 4.0 con el SAT, incluido",
    desc: "Factura a tus huéspedes sin pagar software extra.",
    style: "light",
    span: "",
  },
  {
    Icon: LifeBuoy,
    titulo: "Soporte directo con el equipo fundador",
    desc: "Hablas con quien construye Kora, no con un call center que te deja en espera.",
    style: "light",
    span: "sm:col-span-2",
  },
];

const styleMap = {
  dark: {
    wrapper: "bg-kora-primary",
    chip: "bg-kora-accent/20",
    icon: "text-kora-accent",
    titulo: "text-white text-lg sm:text-xl",
    desc: "text-white/65",
  },
  accent: {
    wrapper: "bg-kora-accent",
    chip: "bg-kora-primary/10",
    icon: "text-kora-primary",
    titulo: "text-kora-primary",
    desc: "text-kora-primary/70",
  },
  light: {
    wrapper: "bg-white border border-gray-100",
    chip: "bg-kora-accent/15",
    icon: "text-kora-primary",
    titulo: "text-kora-text",
    desc: "text-kora-muted",
  },
};

export function DiferenciadoresSection() {
  return (
    <section id="por-que-kora" className="section-divider py-20 sm:py-24 bg-white scroll-mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-kora-primary/70 mb-3">
              Por qué Kora
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-kora-text">
              No es otro software gringo adaptado a México
            </h2>
            <p className="mt-4 text-kora-muted text-base sm:text-lg leading-relaxed">
              Lo que un sistema gringo y caro nunca te va a dar: alguien que entiende
              tu hotel, en tu idioma, de tu lado.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tiles.map(({ Icon, titulo, desc, style, span, founder }, i) => {
            const s = styleMap[style];
            return (
              <Reveal key={titulo} delay={0.05 + i * 0.06} className={`${span} h-full`}>
                <div
                  className={`group ${s.wrapper} rounded-2xl p-6 h-full flex flex-col transition-transform duration-300 hover:-translate-y-1 ${
                    style === "dark"
                      ? "justify-between min-h-[240px] lg:min-h-[300px]"
                      : "min-h-[150px]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl ${s.chip} flex items-center justify-center flex-shrink-0 mb-4 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110 group-hover:-rotate-6`}
                    >
                      <Icon size={20} className={s.icon} aria-hidden="true" />
                    </div>
                    {founder && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={FUNDADOR.foto}
                        alt={`Foto de ${FUNDADOR.nombre}`}
                        className="w-14 h-14 rounded-full object-cover ring-2 ring-kora-accent/60 flex-shrink-0"
                      />
                    )}
                  </div>
                  <div>
                    <h3 className={`font-bold leading-snug ${s.titulo}`}>{titulo}</h3>
                    <p className={`mt-2 text-sm leading-relaxed ${s.desc}`}>{desc}</p>
                    {founder && (
                      <p className="mt-4 text-sm font-semibold text-white">
                        {FUNDADOR.nombre}
                        <span className="block text-xs font-normal text-white/60">
                          Fundador · dueño del Hotel Paraíso Encantado
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
