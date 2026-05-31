"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { BotonWhatsApp } from "@/components/shared/BotonWhatsApp";
import { ScrollProgressBar } from "@/components/shared/ScrollProgressBar";
import { PageTransition } from "@/components/shared/PageTransition";

// Marco del sitio: aplica el chrome correcto según la sección.
// - Páginas públicas del hotel (/h, /g): sin chrome de Kora (son del hotelero).
// - Área de cuenta (/entrar, /panel): barra mínima con el logo.
// - Resto (landing + herramientas): chrome de marketing completo.
export function SiteFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  const esPaginaHotel = path.startsWith("/h/") || path.startsWith("/g/");
  const esApp = path === "/entrar" || path.startsWith("/panel");

  if (esPaginaHotel) {
    return <>{children}</>;
  }

  if (esApp) {
    return (
      <>
        <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white/95 backdrop-blur-sm border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
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
    </>
  );
}
