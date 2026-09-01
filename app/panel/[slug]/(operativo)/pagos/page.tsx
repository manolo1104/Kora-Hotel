import { requireHotelMember } from "@/lib/tenant";
import PagosClient from "./PagosClient";
import { puedeCtx } from "@/lib/panel/permisos";

export const dynamic = "force-dynamic";

export default async function PagosPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug);

  // La página entera es del dueño. `requireHotelMember` sólo comprueba membresía,
  // así que antes entraba cualquier rol —limpieza, cocina, recepción— y veía
  // saldo, los últimos cobros con su comisión, los depósitos al banco y un enlace
  // que abre el Express Dashboard de Stripe del hotel ya autenticado, donde se
  // cambia la cuenta bancaria a la que caen los depósitos. La API ya devuelve 403
  // (app/api/panel/connect/route.ts); esto evita además la pantalla a medias.
  if (!puedeCtx(ctx, "pagos:ver")) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-[#1B4332]">Pagos</h1>
        <p className="mt-3 text-sm text-kora-muted">
          Solo el dueño del hotel puede ver los pagos y la cuenta bancaria.
        </p>
      </div>
    );
  }

  return <PagosClient rol={ctx.rol} hotelNombre={ctx.hotel.nombre} />;
}
