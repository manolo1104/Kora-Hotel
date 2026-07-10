"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackCta } from "@/lib/analytics";

// Link de CTA con medición (cta_click en GA4). Existe para poder medir clics
// desde componentes de servidor, donde no se puede pasar un onClick.
export function CtaLink({
  href,
  ctaName,
  className,
  children,
  target,
  rel,
}: {
  href: string;
  ctaName: string;
  className?: string;
  children: ReactNode;
  target?: string;
  rel?: string;
}) {
  return (
    <Link
      href={href}
      className={className}
      target={target}
      rel={rel}
      onClick={() => trackCta(ctaName)}
    >
      {children}
    </Link>
  );
}
