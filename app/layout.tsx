import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import { SiteFrame } from "@/components/shared/SiteFrame";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.vercel.app"),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  return (
    <html lang="es" className={jakarta.variable}>
      <body className="antialiased">
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
