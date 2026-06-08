import type { Metadata } from "next";
import { isCrmAuthed } from "@/lib/crm/auth";
import { supabaseEnvReady } from "@/lib/supabase/env";
import { adminEnvReady } from "@/lib/supabase/admin";
import { CrmLogin } from "@/components/crm/CrmLogin";
import { CrmHeader } from "@/components/crm/CrmHeader";

export const metadata: Metadata = {
  title: "CRM | Kora",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  if (!supabaseEnvReady || !adminEnvReady) {
    return (
      <main className="pt-16">
        <section className="py-20 bg-kora-bg min-h-[60vh]">
          <div className="max-w-md mx-auto px-4 text-center">
            <h1 className="text-2xl font-bold text-kora-text">Configuración pendiente</h1>
            <p className="mt-3 text-kora-muted text-sm leading-relaxed">
              El CRM se activa al configurar la base de datos. Falta la variable{" "}
              <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">SUPABASE_SERVICE_ROLE_KEY</code>{" "}
              y correr <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">sql/kora-crm-schema.sql</code>.
            </p>
          </div>
        </section>
      </main>
    );
  }

  if (!(await isCrmAuthed())) {
    return <CrmLogin />;
  }

  return (
    <div className="min-h-screen bg-kora-bg">
      <CrmHeader />
      {children}
    </div>
  );
}
