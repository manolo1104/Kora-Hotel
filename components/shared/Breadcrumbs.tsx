import Link from "next/link";
import { JsonLd } from "@/components/shared/JsonLd";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export interface Crumb {
  name: string;
  href: string;
}

// Migas de pan reutilizables: render visual + JSON-LD BreadcrumbList (URLs absolutas).
// El último item se muestra como texto (página actual), los demás como enlaces.
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.href.startsWith("http") ? it.href : `${SITE_URL}${it.href}`,
    })),
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <nav aria-label="Breadcrumb" className="text-sm text-kora-muted">
        <ol className="flex items-center gap-2 flex-wrap">
          {items.map((it, i) => {
            const last = i === items.length - 1;
            return (
              <li key={it.href} className="flex items-center gap-2">
                {i > 0 && (
                  <span aria-hidden="true" className="text-gray-300">/</span>
                )}
                {last ? (
                  <span className="text-kora-text font-medium">{it.name}</span>
                ) : (
                  <Link
                    href={it.href}
                    className="hover:text-kora-primary transition-colors"
                  >
                    {it.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
