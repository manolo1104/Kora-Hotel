"use client";

import { useEffect } from "react";

interface Props {
  ga4Id?: string | null;
  metaPixelId?: string | null;
}

// Stub estándar de Meta Pixel mientras carga fbevents.js (tipado, sin any).
type FbqStub = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: FbqStub;
  loaded: boolean;
  version: string;
};

// Carga GA4 y/o Meta Pixel DEL HOTEL en las páginas del motor (/h/[slug]/…).
// Son los IDs que el hotelero configuró en su panel; si no configuró nada, este
// componente no hace nada. Idempotente: no re-inyecta si ya están cargados.
export function HotelAnalytics({ ga4Id, metaPixelId }: Props) {
  useEffect(() => {
    // GA4 — inyecta gtag.js si hace falta y registra la propiedad del hotel.
    if (ga4Id && /^G-[A-Z0-9]+$/i.test(ga4Id)) {
      const w = window;
      if (!w.dataLayer) w.dataLayer = [];
      if (typeof w.gtag !== "function") {
        w.gtag = (...args: unknown[]) => {
          w.dataLayer!.push(args);
        };
        w.gtag("js", new Date());
      }
      if (!document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]')) {
        const s = document.createElement("script");
        s.async = true;
        s.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id}`;
        document.head.appendChild(s);
      }
      w.gtag("config", ga4Id);
    }

    // Meta Pixel — snippet estándar, solo una vez.
    if (metaPixelId && /^\d{5,20}$/.test(metaPixelId)) {
      const w = window as Window & { _fbq?: FbqStub };
      if (typeof w.fbq !== "function") {
        const stub = ((...args: unknown[]) => {
          if (stub.callMethod) stub.callMethod(...args);
          else stub.queue.push(args);
        }) as FbqStub;
        stub.queue = [];
        stub.push = stub;
        stub.loaded = true;
        stub.version = "2.0";
        w.fbq = stub;
        if (!w._fbq) w._fbq = stub;
        const s = document.createElement("script");
        s.async = true;
        s.src = "https://connect.facebook.net/en_US/fbevents.js";
        document.head.appendChild(s);
      }
      w.fbq!("init", metaPixelId);
      w.fbq!("track", "PageView");
    }
  }, [ga4Id, metaPixelId]);

  return null;
}
