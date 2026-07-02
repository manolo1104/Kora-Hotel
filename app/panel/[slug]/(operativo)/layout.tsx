import type { Metadata } from "next";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { requireHotelMember } from "@/lib/tenant";
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
  return (
    <div className={styles.shell}>
      <AdminSidebar slug={slug} hotelName={ctx.hotel.nombre} />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
