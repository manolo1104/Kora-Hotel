import { requireHotelMember } from "@/lib/tenant";
import { accesoDelHotel } from "@/lib/suscripcion";
import { HotelBloqueado } from "@/components/panel/PruebaEstado";

export const dynamic = "force-dynamic";

/**
 * Puerta de entrada de TODO /panel/[slug]. Existe por una sola razón: si Kora
 * bloquea la cuenta, el hotelero no debe poder entrar a NINGUNA de sus
 * pantallas — ni al panel operativo, ni al editor del sitio, ni al onboarding.
 *
 * Va aquí arriba y no pantalla por pantalla porque así también cubre las que se
 * agreguen después: cuando esto devuelve el mensaje de bloqueo, `children`
 * nunca se renderiza y los layouts de adentro ni siquiera corren.
 *
 * Lo demás (prueba vencida, plan sin pagar) NO se decide aquí: eso lo sigue
 * manejando el layout del grupo (operativo), que sí distingue entre "pausado
 * por el plan" y "bloqueado por Kora".
 */
export default async function PanelHotelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug); // gate: redirige si no es miembro
  const acceso = await accesoDelHotel(ctx.hotel);

  if (acceso.bloqueado) {
    return (
      <main className="min-h-screen bg-kora-bg">
        <HotelBloqueado
          hotelNombre={ctx.hotel.nombre}
          mensaje={acceso.mensajeBloqueo ?? "Kora bloqueó esta cuenta."}
        />
      </main>
    );
  }

  return <>{children}</>;
}
