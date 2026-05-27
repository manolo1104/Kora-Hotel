import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-[#0F1F15] text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <p className="text-2xl font-bold text-white tracking-tight">Kora</p>
            <p className="text-sm text-white/50 mt-1">
              Hecho en la Huasteca Potosina, México
            </p>
          </div>

          <nav
            className="flex items-center gap-6 text-sm text-white/50"
            aria-label="Links del pie de página"
          >
            <Link href="/privacidad" className="hover:text-white transition-colors">
              Política de privacidad
            </Link>
            <Link href="/terminos" className="hover:text-white transition-colors">
              Términos
            </Link>
          </nav>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-sm text-white/30">
            © 2026 Kora. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
