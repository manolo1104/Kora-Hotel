import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EditorVisual } from "@/components/panel/EditorVisual";
import { requireHotelMember } from "@/lib/tenant";
import { ownerTienePlanActivo, accesoDelHotel } from "@/lib/suscripcion";
import { getResenasPublicadas } from "@/lib/db/reviews";
import { hoyMx, type MiniExtras } from "@/lib/mini";
import type { MiniDatos, MiniHabitacion, MiniResena } from "@/components/mini/MiniRender";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Editor visual | Kora",
  robots: { index: false },
};

// Editor a ancho completo: a la izquierda los bloques, a la derecha la página
// real. Va en su propia ruta (y no como pestaña de /sitio) porque la pantalla
// partida necesita todo el ancho, mientras que /sitio es una columna angosta.
export default async function EditorVisualPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);
  const hotel = ctx.hotel as unknown as {
    id: string;
    slug: string;
    owner_id: string;
    nombre: string;
    ubicacion: string | null;
    descripcion: string | null;
    whatsapp: string | null;
    habitaciones: MiniHabitacion[] | null;
    fotos: string[] | null;
    extras: MiniExtras | null;
    created_at: string | null;
  };
  if (!hotel?.id) notFound();

  // La vista previa tiene que enseñar la página COMO LA VERÁ EL HUÉSPED, así que
  // los datos que no se editan aquí (reseñas verificadas, si el motor está
  // activo, si la marca de Kora se oculta) se resuelven igual que en /h/[slug].
  const capturadas = await getResenasPublicadas(hotel.id);
  const extras = hotel.extras ?? {};
  const resenasHT = (extras.resenas ?? [])
    .filter((r) => (r.texto ?? "").trim())
    .map((r) => ({
      estrellas: Number(r.estrellas) || 0,
      texto: r.texto ?? "",
      autor: r.autor || "Huésped",
      fecha: r.fecha || "",
      verificada: false,
      respuesta: null as string | null,
    }));
  const resenas: MiniResena[] = [
    ...capturadas
      .filter((r) => r.texto.trim())
      .map((r) => ({
        estrellas: r.estrellas,
        texto: r.texto,
        autor: r.cliente,
        fecha: r.fecha,
        verificada: true,
        respuesta: r.respuesta,
      })),
    ...resenasHT,
  ];
  const conEstrellas = resenas.filter((r) => r.estrellas >= 1 && r.estrellas <= 5);
  const rating =
    conEstrellas.length > 0
      ? conEstrellas.reduce((s, r) => s + r.estrellas, 0) / conEstrellas.length
      : null;

  const marcaOculta =
    extras.premium?.marcaOculta === true && (await ownerTienePlanActivo(hotel.owner_id));
  const acceso = await accesoDelHotel({
    owner_id: hotel.owner_id,
    created_at: hotel.created_at,
    extras: hotel.extras as Record<string, unknown> | null,
  });

  const datos: MiniDatos = {
    slug: hotel.slug,
    nombre: hotel.nombre,
    ubicacion: hotel.ubicacion,
    descripcion: hotel.descripcion,
    whatsapp: hotel.whatsapp,
    habitaciones: hotel.habitaciones ?? [],
    fotos: hotel.fotos ?? [],
    extras,
    resenas,
    rating,
    totalResenas: conEstrellas.length,
    motorActivo: acceso.activo,
    marcaOculta,
    hoy: hoyMx(),
    // Botones a sitios externos (Pro): mismo criterio que el motor — prueba
    // vigente o suscripción activa.
    pro: acceso.activo,
  };

  return <EditorVisual hotelId={hotel.id} userId={ctx.userId} datosIniciales={datos} />;
}
