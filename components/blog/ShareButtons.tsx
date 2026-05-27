"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Link2, Check } from "lucide-react";

interface ShareButtonsProps {
  title: string;
  slug: string;
}

export function ShareButtons({ title, slug }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(window.location.href);
  }, []);

  const handleCopy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const waText = `Te puede interesar: ${title}\n${url}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(waText)}`;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-kora-muted uppercase tracking-widest mb-1">
        Compartir
      </p>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:bg-[#1da851] transition-colors"
      >
        <MessageCircle size={15} aria-hidden="true" />
        WhatsApp
      </a>
      <button
        onClick={handleCopy}
        className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-kora-bg border border-gray-200 text-kora-text text-sm font-semibold hover:bg-gray-50 transition-colors"
        aria-label="Copiar enlace"
      >
        {copied ? (
          <>
            <Check size={15} className="text-kora-accent" aria-hidden="true" />
            <span className="text-kora-accent">Copiado</span>
          </>
        ) : (
          <>
            <Link2 size={15} aria-hidden="true" />
            Copiar enlace
          </>
        )}
      </button>
    </div>
  );
}
