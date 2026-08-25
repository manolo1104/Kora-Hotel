import { resolveHotel } from "@/lib/tenant";
import { getBooking } from "@/lib/db/bookings";
import { COLOR_DEFAULT, inkFor, fontStack, type MiniExtras } from "@/lib/mini";
import { normalizeLang } from "@/lib/booking/i18n";
import { ResenaForm } from "./ResenaForm";

export const dynamic = "force-dynamic";

const GOOGLE_REVIEW_FALLBACK = "https://search.google.com/local/writereview";

function hoyMX(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });
}

interface BookingLite {
  id: string;
  confirmacion: string | null;
  cliente: string | null;
  checkin: string | null;
  estado: string | null;
}

export default async function ResenaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ r?: string; lang?: string; rating?: string }>;
}) {
  const { slug } = await params;
  const { r, lang: langParam, rating } = await searchParams;
  const lang = normalizeLang(langParam) === "en" ? "en" : "es";
  // `rating` viene de las estrellas del correo de +1 día: llega con la
  // calificación ya elegida para que el huésped solo confirme.
  const ratingInicial = /^[1-5]$/.test(rating ?? "") ? Number(rating) : 0;

  const hotel = await resolveHotel(slug);

  const extras = (hotel?.extras ?? {}) as MiniExtras & Record<string, unknown>;
  const diseno = extras.diseno ?? {};
  const color = diseno.color || COLOR_DEFAULT;
  const ink = inkFor(color);
  const font = fontStack(diseno.fuente);

  // Mensaje simple centrado en la tarjeta de marca (para los casos borde).
  const shell = (contenido: React.ReactNode) => (
    <main
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={
        {
          "--brand": color,
          "--brand-ink": ink,
          fontFamily: font,
          background: "color-mix(in srgb, var(--brand) 6%, #f8fafc)",
        } as React.CSSProperties
      }
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl ring-1 ring-black/5">
        {contenido}
      </div>
    </main>
  );

  const noElegible = (msg: string) => shell(<p className="text-center text-sm text-gray-600">{msg}</p>);

  if (!hotel) {
    return noElegible(
      lang === "en" ? "We couldn't find this hotel." : "No encontramos este hotel.",
    );
  }

  const booking = r ? ((await getBooking(hotel.id, r)) as BookingLite | null) : null;
  if (!booking) {
    return noElegible(
      lang === "en"
        ? "We couldn't find your reservation. Please use the link from your email."
        : "No encontramos tu reserva. Usa el enlace que te llegó por correo.",
    );
  }
  if (booking.estado === "CANCELADA" || booking.estado === "REEMBOLSADA") {
    return noElegible(
      lang === "en"
        ? "This reservation isn't eligible for a review."
        : "Esta reserva no es elegible para dejar una reseña.",
    );
  }
  // Solo se reseña tras haber llegado (checkin en el pasado o presente).
  if (booking.checkin && booking.checkin > hoyMX()) {
    return noElegible(
      lang === "en"
        ? "You'll be able to leave a review after your stay. See you soon!"
        : "Podrás dejar tu reseña después de tu estancia. ¡Te esperamos!",
    );
  }

  const reviewUrl =
    (typeof extras.reviewUrl === "string" && extras.reviewUrl.trim()) ||
    (typeof (hotel.config as Record<string, unknown>)?.review_url === "string" &&
      String((hotel.config as Record<string, unknown>).review_url).trim()) ||
    GOOGLE_REVIEW_FALLBACK;

  const clienteName = (booking.cliente ?? "").trim().split(/\s+/)[0] ?? "";

  return shell(
    <ResenaForm
      slug={slug}
      r={booking.id}
      clienteName={clienteName}
      reviewUrl={reviewUrl}
      lang={lang}
      ratingInicial={ratingInicial}
    />,
  );
}
