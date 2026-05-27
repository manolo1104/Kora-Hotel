"use client";

import { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";

const WA_URL = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "524891251458"}?text=Hola%2C%20vi%20Kora%20y%20quiero%20saber%20m%C3%A1s%20para%20mi%20hotel`;

export function BotonWhatsApp() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <a
      href={WA_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`fixed bottom-6 right-6 z-50 group flex items-center justify-center rounded-full shadow-lg transition-all duration-300 bg-[#25D366] hover:bg-[#1da851] w-14 h-14 md:w-16 md:h-16 ${
        visible ? "scale-100 opacity-100" : "scale-0 opacity-0"
      }`}
      aria-label="Escríbenos por WhatsApp"
    >
      <MessageCircle size={28} className="text-white" aria-hidden="true" />

      <span
        className="absolute right-full mr-3 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        role="tooltip"
      >
        Escríbenos por WhatsApp
      </span>
    </a>
  );
}
