import type { Metadata } from "next";
import AdminSidebar from "@/components/admin/AdminSidebar";
import GuidedTour from "@/components/panel/GuidedTour";
import { requireHotelMember } from "@/lib/tenant";
import { accesoDelHotel } from "@/lib/suscripcion";
import { motorEnModoPrueba } from "@/lib/motor/modo-prueba";
import { puedeCtx } from "@/lib/panel/permisos";
import { PruebaBanner, PruebaVencida, HotelBloqueado } from "@/components/panel/PruebaEstado";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Panel operativo | Kora",
  robots: { index: false, follow: false },
};

export default async function PanelOperativoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requireHotelMember(slug); // gate: redirige si no es miembro

  // Prueba gratis: banner con cuenta regresiva mientras corre; al vencer,
  // el panel operativo se pausa (los datos se conservan íntegros).
  const acceso = await accesoDelHotel(ctx.hotel);

  // ¿Su motor SIMULA el pago? El banner tiene que decirlo: hasta el 15 sep 2026
  // el hotelero en prueba probaba su motor sin saber si se cobraba de verdad.
  // Sólo hace falta mientras corra la prueba (es cuando se pinta el banner), y
  // `ctx.hotel` ya trae `stripe_account_id`, así que no hay lectura de más.
  const enPrueba = Boolean(acceso.prueba && !acceso.prueba.vencida);
  const modoPrueba = enPrueba ? await motorEnModoPrueba(ctx.hotel, acceso) : false;

  // Tour guiado: arranca solo la primera vez (extras.onboarding.tourVisto).
  const onboarding = (ctx.hotel.extras?.onboarding ?? {}) as Record<string, unknown>;
  const tourVisto = onboarding.tourVisto === true;

  // Cuenta bloqueada por Kora: ni menú lateral ni tour. Solo el mensaje — es lo
  // ÚNICO que puede ver mientras dure el bloqueo.
  if (acceso.bloqueado) {
    return (
      <div className={styles.shell}>
        <div className={styles.content}>
          <HotelBloqueado
            hotelNombre={ctx.hotel.nombre}
            mensaje={acceso.mensajeBloqueo ?? "Kora bloqueó esta cuenta."}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <AdminSidebar
        slug={slug}
        hotelName={ctx.hotel.nombre}
        rol={ctx.rol}
        pantallas={ctx.pantallas}
      />
      <div className={styles.content}>
        {acceso.prueba && !acceso.prueba.vencida && (
          <PruebaBanner
            prueba={acceso.prueba}
            modoPrueba={modoPrueba}
            // Recepción no puede abrir Pagos: sin permiso, el aviso dice que lo
            // conecte el dueño en vez de dar un enlace que acaba en un 403.
            pagosHref={puedeCtx(ctx, "pagos:ver") ? `/panel/${slug}/pagos` : null}
          />
        )}
        {acceso.activo ? children : <PruebaVencida hotelNombre={ctx.hotel.nombre} />}
      </div>
      {acceso.activo && <GuidedTour initialVisto={tourVisto} />}
    </div>
  );
}
