import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Playfair_Display, Lora, Poppins } from "next/font/google";
import Script from "next/script";
import { SiteFrame } from "@/components/shared/SiteFrame";
import { FUNDADOR } from "@/lib/fundador";
import "./globals.css";
import { JsonLd } from "@/components/shared/JsonLd";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

// Tipografías opcionales que el hotelero puede elegir para su mini-página.
// preload: false para no descargarlas en el resto del sitio (solo se usan si
// la mini-página las referencia vía CSS variable).
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
  weight: ["400", "600", "700"],
  preload: false,
});
const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
  weight: ["400", "500", "600"],
  preload: false,
});
const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
  weight: ["400", "500", "600", "700"],
  preload: false,
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: {
    siteName: "Kora",
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

// Entidad global (Organization + WebSite) en todas las páginas, para reconocimiento
// de entidad en Google y motores de IA. Las páginas referencian #organization por @id.
const orgJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Kora",
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/opengraph-image` },
      description:
        "Sistema hotelero todo-en-uno con IA para hoteles boutique en México.",
      email: "hola@korahotel.mx",
      foundingDate: "2026",
      areaServed: { "@type": "Country", name: "México" },
      knowsAbout: [
        "Sistema hotelero",
        "Motor de reservas directas",
        "PMS para hoteles",
        "Agente de WhatsApp con IA",
      ],
      founder: {
        "@type": "Person",
        name: "Manolo Covarrubias",
        jobTitle: "Fundador de Kora",
        sameAs: [FUNDADOR.linkedin, FUNDADOR.instagram],
      },
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "hola@korahotel.mx",
        availableLanguage: ["Spanish"],
        areaServed: "MX",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "Kora",
      inLanguage: "es-MX",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  return (
    <html
      lang="es"
      className={`${jakarta.variable} ${playfair.variable} ${lora.variable} ${poppins.variable}`}
    >
      <body className="antialiased">
        <JsonLd data={orgJsonLd} />
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">{`
              window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
              gtag('js',new Date());gtag('config','${gaId}');
            `}</Script>
          </>
        )}
        <SiteFrame>{children}</SiteFrame>
      </body>
    </html>
  );
}
