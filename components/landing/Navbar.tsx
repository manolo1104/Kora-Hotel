"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Características", href: "/caracteristicas" },
  { label: "Cómo funciona", href: "/como-funciona" },
  { label: "Precios", href: "/precios" },
  { label: "Blog", href: "/blog" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById("hero-sentinel");
    if (!sentinel) {
      // Páginas internas: siempre mostrar fondo blanco
      setScrolled(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/95 backdrop-blur-sm shadow-sm border-b border-gray-100"
          : "bg-transparent"
      }`}
    >
      <nav
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between"
        aria-label="Navegación principal"
      >
        <a
          href="/"
          className="text-2xl font-bold tracking-tight text-kora-primary"
          aria-label="Kora - Inicio"
        >
          Kora
        </a>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-kora-text hover:text-kora-primary transition-colors"
            >
              {link.label}
            </a>
          ))}
          <a
            href="/#contacto"
            className="inline-flex items-center px-5 py-2.5 rounded-full bg-kora-primary text-white text-sm font-semibold hover:bg-kora-primary-dark transition-colors"
          >
            Solicitar demo
          </a>
        </div>

        <button
          className="md:hidden p-2 text-kora-text rounded-md"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {menuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-5 space-y-4 shadow-lg">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block text-sm font-medium text-kora-text py-1"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <a
            href="/#contacto"
            className="block w-full text-center px-5 py-3 rounded-full bg-kora-primary text-white text-sm font-semibold"
            onClick={() => setMenuOpen(false)}
          >
            Solicitar demo
          </a>
        </div>
      )}
    </header>
  );
}
