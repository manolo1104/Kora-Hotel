import { redirect } from "next/navigation";
import { requireHotelMember } from "@/lib/tenant";
import { pantallaDe } from "@/components/panel/SinPermiso";

// /panel/[slug] no tiene contenido propio: manda a la primera pantalla de quien
// entra.
//
// Antes mandaba a `insights` (Inicio) para todo el mundo, y ésa es de mando: una
// camarista que abriera la dirección de su hotel aterrizaba en una puerta
// cerrada. `pantallaDe` mira su puesto Y las pestañas que el dueño le dejó.
export default async function PanelSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug); // gate de sesión y membresía
  redirect(pantallaDe(ctx.rol, slug, ctx.pantallas));
}
