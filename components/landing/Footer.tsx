import Link from "next/link";

const navLinks = [
  { label: "Inicio", href: "/" },
  { label: "Características", href: "/caracteristicas" },
  { label: "Precios", href: "/precios" },
  { label: "Blog", href: "/blog" },
  { label: "Demo", href: "/casos/paraiso-encantado" },
];

const legalLinks = [
  { label: "Política de privacidad", href: "/privacidad" },
  { label: "Términos de servicio", href: "/terminos" },
];

export function Footer() {
  return (
    <footer className="bg-[#0F1F15] text-white pt-14 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 pb-10 border-b border-white/10">
          {/* Brand */}
          <div>
            <p className="text-2xl font-bold text-white tracking-tight">Kora</p>
            <p className="text-sm text-white/50 mt-1 leading-relaxed">
              Sistema hotelero con IA para hoteles boutique en México.
            </p>
            <p className="text-sm text-white/40 mt-3">
              Hecho en la Huasteca Potosina, México
            </p>
          </div>

          {/* Nav */}
          <nav aria-label="Navegación del pie de página">
            <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">
              Producto
            </p>
            <ul className="space-y-2.5">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/60 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contact */}
          <div>
            <p className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">
              Contacto
            </p>
            <ul className="space-y-2.5">
              <li>
                <a
                  href="mailto:hola@korahotel.mx"
                  className="text-sm text-white/60 hover:text-white transition-colors"
                >
                  hola@korahotel.mx
                </a>
              </li>
              <li>
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "524891251458"}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-white/60 hover:text-white transition-colors"
                >
                  WhatsApp +52 489 125 1458
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <p className="text-xs text-white/30">
            © 2026 Kora. Todos los derechos reservados.
          </p>
          <nav
            className="flex items-center gap-5 text-xs text-white/40"
            aria-label="Links legales"
          >
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="hover:text-white/70 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
