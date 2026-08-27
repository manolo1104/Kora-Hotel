import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/shared/Reveal";
import { SuscripcionForm } from "@/components/shared/SuscripcionForm";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export const metadata: Metadata = {
  title: "El Plan de 90 días para dejar de depender de Booking | Kora",
  description:
    "Cómo bajé la dependencia de OTAs de mi hotel del 40% al 25% en tres meses. El plan completo semana por semana, gratis, con las plantillas de WhatsApp que usé.",
  alternates: { canonical: "/guia" },
  openGraph: {
    title: "El Plan de 90 días para dejar de depender de Booking",
    description:
      "Del 40% al 25% de dependencia de OTAs en tres meses. El plan completo, semana por semana, escrito por un hotelero.",
    type: "article",
    locale: "es_MX",
    siteName: "Kora",
    url: `${BASE_URL}/guia`,
  },
};

// La página de la guía. Es el imán de toda la captación por correo.
//
// EL PLAN ESTÁ COMPLETO Y A LA VISTA, sin pedir el correo. Es deliberado:
//   · una guía escondida no posiciona en Google, y esta compite por la búsqueda
//     que más vale de todo el sitio ("cómo dejar de depender de Booking");
//   · esconderla obliga a prometer en el formulario algo que nadie puede juzgar
//     todavía, y eso capta correos falsos;
//   · si el plan se lee y sirve, el correo se da por lo que viene después.
// Lo que se manda por correo es lo que NO cabe aquí: las plantillas listas y
// los cuatro correos de seguimiento.

const SEMANAS = [
  {
    rango: "Semana 0",
    titulo: "Saca tu número, antes de tocar nada",
    cuerpo:
      "De las reservas del último mes, ¿cuántas llegaron por Booking, Airbnb o Expedia? Divídelo entre el total. Ese porcentaje es tu punto de partida y es el único número que vas a comparar en la semana 12. Sin él, en tres meses vas a creer que mejoraste sin poder demostrarlo.",
    ojo: "Cuenta reservas, no ingresos. Los ingresos se mueven por temporada y te van a mentir.",
  },
  {
    rango: "Semanas 1 a 3",
    titulo: "Una página donde de verdad se pueda reservar",
    cuerpo:
      "No un formulario de contacto: reservar. Elegir fechas, ver el precio, pagar el anticipo y recibir la confirmación sin que tú tengas que estar. Si el huésped tiene que esperar a que le contestes para apartar, se va a la OTA — ahí sí puede terminar solo, a las once de la noche.",
    ojo: "El 60% de los mensajes de mi hotel llegaban fuera de horario. Ahí se perdía casi todo.",
  },
  {
    rango: "Semanas 4 a 6",
    titulo: "Contestar en minutos, no en horas",
    cuerpo:
      "Quien pregunta por WhatsApp está comparando entre tres hoteles al mismo tiempo. El primero que contesta con un precio claro y una forma de apartar se lleva la reserva. No necesitas estar despierto: necesitas que haya una respuesta.",
    ojo: "Contestar “déjame checar y te aviso” cuenta como no contestar.",
  },
  {
    rango: "Semanas 7 a 9",
    titulo: "Dale al directo algo que la OTA no pueda vender",
    cuerpo:
      "Late check-out, una botella de vino, el mejor cuarto de esa categoría, desayuno para dos. Cuesta poco y no se puede publicar en Booking. Es lo que hace que la persona que ya te encontró decida reservar contigo y no en la app.",
    ojo: "No es un descuento. Ver el error 1, abajo.",
  },
  {
    rango: "Semanas 10 a 12",
    titulo: "Pide la reseña el día correcto, y vuelve a medir",
    cuerpo:
      "Al día siguiente de que se van, no una semana después. Las reseñas en Google son las que hacen que el siguiente huésped te encuentre sin pagar comisión. Y al cerrar la semana 12, saca otra vez el número de la semana 0.",
    ojo: "Un mensaje corto con el link directo. Si tiene que buscar dónde escribir, no escribe.",
  },
];

const ERRORES = [
  {
    n: "Error 1",
    titulo: "Bajar el precio en tu página para ganarle a Booking",
    cuerpo:
      "Booking lo detecta y te castiga la posición dentro de su buscador, así que pierdes las dos cosas: el margen y la visibilidad. El directo no se gana con precio, se gana con lo que le das al huésped que reserva contigo. Me costó el primer mes entero.",
  },
  {
    n: "Error 2",
    titulo: "Querer salirte de las OTAs",
    cuerpo:
      "Booking te trae gente que jamás te habría encontrado, y eso vale lo que cuesta. El objetivo no es cerrar ese canal: es que el huésped que ya te vio en Instagram o en Google no se vaya a buscarte a la app para reservar. Ese es el que estás pagando de más.",
  },
];

const PLANTILLAS = [
  {
    cuando: "Cuando preguntan precio",
    texto:
      "Hola [nombre], claro que sí. Para esas fechas tengo la [habitación] en $X la noche, incluye [lo que incluye]. Te la puedo apartar hoy con el 30% y el resto lo pagas al llegar. ¿Te la aparto?",
    porque: "Cierra en vez de informar. Contestar sólo el número deja la pelota del lado del huésped.",
  },
  {
    cuando: "Cuando no contestaron en 24 h",
    texto:
      "Hola [nombre], sigo con la [habitación] libre para el [fecha], pero se me está moviendo el fin de semana. ¿Todavía la quieres o la libero?",
    porque: "Usa escasez real. Si te la inventas se nota, y pierdes al huésped y la reputación.",
  },
  {
    cuando: "Tres días antes de la llegada",
    texto:
      "[nombre], ya casi. Los espero el [fecha] a partir de las 3 pm. Aquí está cómo llegar: [link]. ¿Vienen en coche o los recojo en la central?",
    porque: "Te compra el permiso de mandar un mensaje más. Ahí es donde se venden los extras.",
  },
];

export default function GuiaPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Plan de 90 días para bajar la dependencia de OTAs de un hotel",
    description:
      "Plan semana por semana para que un hotel independiente en México reduzca el porcentaje de reservas que llegan por Booking, Airbnb y Expedia.",
    url: `${BASE_URL}/guia`,
    author: { "@type": "Person", name: "Manolo Covarrubias" },
    step: SEMANAS.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.titulo,
      text: s.cuerpo,
    })),
  };

  return (
    <main className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── Portada ────────────────────────────────────────────────────── */}
      <section className="bg-kora-primary px-4 pb-16 pt-20 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-kora-accent">
              Guía gratis · escrita por un hotelero
            </p>
            <h1 className="mt-4 text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl">
              El Plan de 90 días para dejar de depender de Booking
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/70">
              Tengo un hotel en Xilitla, San Luis Potosí. En tres meses bajé la
              parte de mis reservas que llegaba por OTAs{" "}
              <strong className="font-semibold text-white">del 40% al 25%</strong>.
              Esto es exactamente lo que hice, semana por semana.
            </p>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="mt-9 rounded-2xl border border-white/10 bg-white/[0.06] p-6">
              <p className="text-sm font-bold text-white">
                El plan completo está abajo, sin pedirte nada.
              </p>
              <p className="mb-5 mt-1.5 text-sm leading-relaxed text-white/55">
                Déjame tu correo y te mando además las 3 plantillas de WhatsApp
                listas para copiar, más cuatro correos cortos con lo que no cabe
                en esta página.
              </p>
              <SuscripcionForm
                origen="guia"
                piel="oscuro"
                textoBoton="Mándame las plantillas"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── El plan ────────────────────────────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight text-kora-text sm:text-3xl">
              Las 12 semanas
            </h2>
            <p className="mt-3 leading-relaxed text-kora-muted">
              En este orden. Saltarte la semana 0 es el atajo que más caro sale:
              sin el número de partida no vas a saber si funcionó.
            </p>
          </Reveal>

          <ol className="mt-10 space-y-5">
            {SEMANAS.map((s, i) => (
              <Reveal key={s.rango} delay={0.05 * i}>
                <li className="rounded-2xl border border-gray-200 bg-kora-bg p-6 sm:p-7">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-kora-accent">
                    {s.rango}
                  </p>
                  <h3 className="mt-2 text-lg font-bold leading-snug tracking-tight text-kora-text sm:text-xl">
                    {s.titulo}
                  </h3>
                  <p className="mt-3 leading-relaxed text-kora-muted">{s.cuerpo}</p>
                  <p className="mt-4 border-l-2 border-kora-accent pl-4 text-sm leading-relaxed text-kora-text">
                    {s.ojo}
                  </p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Las plantillas ─────────────────────────────────────────────── */}
      <section className="bg-kora-bg px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight text-kora-text sm:text-3xl">
              Las 3 plantillas de WhatsApp
            </h2>
            <p className="mt-3 leading-relaxed text-kora-muted">
              De todo lo que probé, dejar de improvisar los mensajes fue lo que
              más reservas directas trajo. Cópialas tal cual y cambia lo que va
              entre corchetes.
            </p>
          </Reveal>

          <div className="mt-10 space-y-5">
            {PLANTILLAS.map((p, i) => (
              <Reveal key={p.cuando} delay={0.05 * i}>
                <div className="rounded-2xl border border-gray-200 bg-white p-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-kora-accent">
                    {p.cuando}
                  </p>
                  <p className="mt-3 rounded-xl bg-kora-bg p-4 text-[15px] leading-relaxed text-kora-text">
                    “{p.texto}”
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-kora-muted">
                    <strong className="font-semibold text-kora-text">Por qué funciona:</strong>{" "}
                    {p.porque}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Los dos errores ────────────────────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="text-2xl font-bold tracking-tight text-kora-text sm:text-3xl">
              Los dos errores que me costaron el primer mes
            </h2>
          </Reveal>

          <div className="mt-10 space-y-5">
            {ERRORES.map((e, i) => (
              <Reveal key={e.n} delay={0.05 * i}>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6 sm:p-7">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-700">
                    {e.n}
                  </p>
                  <h3 className="mt-2 text-lg font-bold leading-snug tracking-tight text-kora-text sm:text-xl">
                    {e.titulo}
                  </h3>
                  <p className="mt-3 leading-relaxed text-kora-muted">{e.cuerpo}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Cierre ─────────────────────────────────────────────────────── */}
      <section className="bg-kora-bg px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="rounded-3xl border border-gray-200 bg-white p-7 sm:p-10">
              <h2 className="text-xl font-bold tracking-tight text-kora-text sm:text-2xl">
                ¿Te llevas las plantillas?
              </h2>
              <p className="mb-6 mt-2.5 max-w-xl leading-relaxed text-kora-muted">
                Te las mando por correo junto con cuatro correos cortos: cómo
                sacar tu número de comisiones al año, el detalle de lo que sí
                movió la aguja en mi hotel, y lo que aprendí que no cabe aquí.
                Te das de baja en un clic cuando quieras.
              </p>
              <div className="max-w-md">
                <SuscripcionForm origen="guia-cierre" textoBoton="Mándame las plantillas" />
              </div>

              <p className="mt-8 border-t border-gray-100 pt-6 text-sm leading-relaxed text-kora-muted">
                Si prefieres no armarlo tú, esto es exactamente lo que hace{" "}
                <Link href="/precios" className="font-semibold text-kora-primary underline">
                  Kora
                </Link>
                : la página de reservas, el cobro directo a tu cuenta y el agente
                de WhatsApp que contesta a cualquier hora. $550 al mes, sin
                comisión por reserva.
              </p>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
