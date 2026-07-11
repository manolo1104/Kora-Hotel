import type { Metadata } from "next";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { requireHotelMember } from "@/lib/tenant";
import { accesoDelHotel } from "@/lib/suscripcion";
import { PruebaBanner, PruebaVencida } from "@/components/panel/PruebaEstado";
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

  // Prueba de 30 días: banner con cuenta regresiva mientras corre; al vencer,
  // el panel operativo se pausa (los datos se conservan íntegros).
  const acceso = await accesoDelHotel(ctx.hotel);

  return (
    <div className={styles.shell}>
      <AdminSidebar slug={slug} hotelName={ctx.hotel.nombre} />
      <div className={styles.content}>
        {acceso.prueba && !acceso.prueba.vencida && <PruebaBanner prueba={acceso.prueba} />}
        {acceso.activo ? children : <PruebaVencida hotelNombre={ctx.hotel.nombre} />}
      </div>
    </div>
  );
}
