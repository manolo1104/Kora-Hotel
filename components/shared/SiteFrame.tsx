"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { BotonWhatsApp } from "@/components/shared/BotonWhatsApp";
import { ScrollProgressBar } from "@/components/shared/ScrollProgressBar";
import { PageTransition } from "@/components/shared/PageTransition";
import { ChatWidget } from "@/components/soporte/ChatWidget";

// Marco del sitio: aplica el chrome correcto según la sección.
// - Páginas públicas del hotel (/h, /g): sin chrome de Kora (son del hotelero).
// - CRM interno (/crm): sin chrome de marketing (trae su propio header).
// - Área de cuenta (/entrar, /panel): barra mínima con el logo.
// - Resto (landing + herramientas): chrome de marketing completo.
export function SiteFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  const esPaginaHotel = path.startsWith("/h/") || path.startsWith("/g/");
  const esCrm = path.startsWith("/crm");
  const esApp = path === "/entrar" || path.startsWith("/panel");
  // En /panel el sidebar pinta su hamburguesa fija (40px en top-left): el logo
  // se corre a la derecha en móvil para no encimarse.
  const esPanel = path.startsWith("/panel");

  if (esPaginaHotel || esCrm) {
    return <>{children}</>;
  }

  if (esApp) {
    return (
      <>
        <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white/95 backdrop-blur-sm border-b border-gray-100">
          <div
            className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center ${
              esPanel ? "pl-16 sm:pl-16 md:pl-6 lg:pl-8" : ""
            }`}
          >
            <a
              href="/"
              className="text-2xl font-bold tracking-tight text-kora-primary transition-transform hover:scale-105 origin-left"
              aria-label="Kora - Inicio"
            >
              Kora
            </a>
          </div>
        </header>
        {children}
        <ChatWidget />
      </>
    );
  }

  return (
    <>
      <ScrollProgressBar />
      <Navbar />
      <PageTransition>{children}</PageTransition>
      <Footer />
      <BotonWhatsApp />
      {/* El chat de soporte va arriba del botón de WhatsApp */}
      <ChatWidget elevado />
    </>
  );
}
