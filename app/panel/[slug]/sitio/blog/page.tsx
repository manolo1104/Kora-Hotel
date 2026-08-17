import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogHotel } from "@/components/panel/BlogHotel";
import { requireHotelMember } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog de tu hotel | Kora",
  robots: { index: false },
};

// El blog del hotel: artículos que escriben tráfico de Google hacia su página.
// Misma receta que el editor visual: gate de miembro en el server y un client
// component que guarda con la sesión del hotelero (RLS).
export default async function BlogHotelPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);
  if (!ctx.hotel?.id) notFound();

  return (
    <BlogHotel
      hotelId={ctx.hotelId}
      hotelSlug={slug}
      userId={ctx.userId}
    />
  );
}
