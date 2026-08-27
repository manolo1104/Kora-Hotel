import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { resolveHotel } from "@/lib/tenant";
import { hotelRooms, bookingRules } from "@/lib/booking";
import { COLOR_DEFAULT, inkFor, fontStack, type MiniExtras } from "@/lib/mini";
import { accesoDelHotel } from "@/lib/suscripcion";
import { getConnectState } from "@/lib/stripe/connect";
import { HotelAnalytics } from "@/components/booking/HotelAnalytics";
import ReservarClient from "./ReservarClient";

export const dynamic = "force-dynamic";

/**
 * Lo que ve el huésped cuando la base no responde. Sin marca del hotel a
 * propósito: no tenemos sus datos, y adivinarlos sería peor que no ponerlos.
 */
function MotorNoDisponible() {
  return (
    <div className="min-h-screen w-full bg-kora-bg flex items-center justify-center px-4">
      <meta name="robots" content="noindex, nofollow" />
      <div className="max-w-md w-full rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-kora-text">
          No pudimos cargar la disponibilidad
        </h1>
        <p className="mt-3 text-sm text-kora-muted leading-relaxed">
          Es un problema nuestro, no de tu conexión, y dura poco. Vuelve a cargar
          la página en un minuto — no se te cobró nada.
        </p>
      </div>
    </div>
  );
}

// Motor de reservas PÚBLICO y embebible por hotel. Server component delgado:
// resuelve el hotel por slug (sin auth), pasa los cuartos y el branding al cliente.
export default async function ReservarPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Por qué un try aquí y no un `error.tsx`: medido en build de producción con la
  // llave de Supabase rota, una excepción en la RAÍZ de una página
  // `force-dynamic` no llega a ninguna frontera de error en una carga directa —
  // Next responde 500 con el cuerpo VACÍO, porque todavía no hay nada montado
  // donde pintar el fallback. `app/h/[slug]/error.tsx` sigue sirviendo para
  // navegaciones dentro del sitio y para lo que falle más abajo del árbol.
  //
  // Esta es la página del motor: aquí hay un huésped a punto de pagar. Una
  // página en blanco es lo peor que le puede pasar, así que este camino devuelve
  // HTML de verdad. El código sigue siendo 200 —un componente de servidor no
  // puede fijar el estado de la respuesta— así que lleva `noindex` para que
  // ningún buscador se lleve esto como si fuera la página del hotel.
  let hotel;
  try {
    hotel = await resolveHotel(slug);
  } catch (e) {
    console.error(`[h/${slug}/reservar] no se pudo leer el hotel:`, e);
    return <MotorNoDisponible />;
  }
  if (!hotel) notFound();

  const rooms = hotelRooms(hotel);

  // Branding del hotel (mismo origen que /h/[slug]): color de marca en extras.diseno.
  const extras = (hotel.extras ?? {}) as MiniExtras;
  const diseno = extras.diseno ?? {};
  const color = diseno.color || COLOR_DEFAULT;
  const acento = diseno.acento || color; // si no hay acento, usa el color de marca

  // Prueba de 30 días vencida y sin plan → el motor se pausa. El huésped nunca
  // choca contra una pared: se le deja el contacto directo del hotel.
  const acceso = await accesoDelHotel(hotel);
  if (!acceso.puedeCobrar) {
    const whatsappNum = (hotel.whatsapp ?? "").replace(/\D/g, "");
    return (
      <div className="min-h-screen w-full bg-kora-bg flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          {diseno.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={diseno.logoUrl}
              alt={hotel.nombre}
              className="mx-auto mb-4 h-10 w-auto max-w-[180px] object-contain"
            />
          ) : null}
          <h1 className="text-xl font-bold text-kora-text">{hotel.nombre}</h1>
          <p className="mt-3 text-sm text-kora-muted leading-relaxed">
            Las reservas en línea de este hotel están pausadas por el momento.
            <span className="block mt-1">Online booking is temporarily paused.</span>
          </p>
          {whatsappNum && (
            <a
              href={`https://wa.me/${whatsappNum}?text=${encodeURIComponent(
                `Hola, quiero reservar en ${hotel.nombre}`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-press mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-kora-primary px-6 py-3 text-sm font-bold text-white hover:bg-kora-primary-dark transition-colors"
            >
              <MessageCircle size={16} aria-hidden="true" /> Reservar por WhatsApp
            </a>
          )}
        </div>
      </div>
    );
  }

  // Quitar la marca de Kora es premium: solo se respeta con plan activo del dueño.
  const marcaOculta = extras.premium?.marcaOculta === true && acceso.planActivo;

  // Portada: la 1ª foto del hotel como banner (a menos que el dueño lo desactive).
  const coverUrl = diseno.portada !== false && hotel.fotos?.[0] ? hotel.fotos[0] : null;

  // Reglas de reserva (anticipo, mínimo de noches, rate plan, impuestos, descuentos).
  const rules = bookingRules(hotel);

  // Extras vendibles (add-ons) definidos por el hotel.
  const addons = Array.isArray(extras.addons) ? extras.addons : [];

  // Experiencias vendibles (tours/traslados/cena/spa) del hotel.
  const experiencias = Array.isArray(extras.experiencias) ? extras.experiencias : [];
  const experienciasBundle = extras.experienciasBundle ?? null;

  // Estado Stripe Connect del hotel (cache en BD): decide si se ofrece OXXO y
  // "pagar en hotel" (ambos requieren su cuenta activa).
  const connect = await getConnectState(hotel.id, hotel.stripe_account_id);

  return (
    <>
      {/* Medición DEL HOTEL (GA4/Pixel propios), si los configuró en su panel */}
      <HotelAnalytics
        ga4Id={extras.medicion?.ga4Id || null}
        metaPixelId={extras.medicion?.metaPixelId || null}
      />
      <ReservarClient
        addons={addons}
        experiencias={experiencias}
        experienciasBundle={experienciasBundle}
        slug={slug}
        hotelNombre={hotel.nombre}
        whatsapp={hotel.whatsapp}
        rooms={rooms}
        brandColor={color}
        brandInk={inkFor(color)}
        accentColor={acento}
        accentInk={inkFor(acento)}
        fontStack={fontStack(diseno.fuente)}
        logoUrl={diseno.logoUrl || null}
        coverUrl={coverUrl}
        marcaOculta={marcaOculta}
        demo={extras.demo === true}
        politicaCancelacion={extras.politicas?.cancelacion || null}
        pagoEnHotel={rules.pagoEnHotel && connect.chargesEnabled}
        oxxoDisponible={connect.chargesEnabled && connect.oxxoEnabled}
        reglas={{
          anticipoPct: rules.anticipoPct,
          anticipoMinNoches: rules.anticipoMinNoches,
          minNoches: rules.minNoches,
          nrfActiva: rules.nrfActiva,
          nrfPct: rules.nrfPct,
          cancelacionDias: rules.cancelacionDias,
          ishPct: rules.ishPct,
          weekdayDiscount: rules.nightOpts.weekdayDiscount ?? 0,
          weekdayDiscountUntil: rules.nightOpts.weekdayDiscountUntil,
          temporadas: rules.nightOpts.temporadas ?? [],
          recargoFinDeSemana: rules.nightOpts.recargoFinDeSemana ?? null,
        }}
      />
    </>
  );
}
