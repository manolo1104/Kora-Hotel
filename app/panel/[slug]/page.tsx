import { redirect } from "next/navigation";

// /panel/[slug] no tiene contenido propio: la "casa" del hotel es su
// dashboard (Inicio). El gate de sesión/membresía lo aplica el destino.
export default async function PanelSlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/panel/${slug}/insights`);
}
