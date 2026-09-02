"use client";

import { useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download } from "lucide-react";

/**
 * Un código QR de los de imprimir. Existe como componente porque los tres de la
 * pestaña Compartir eran el mismo bloque copiado, y los tres compartían los dos
 * defectos que los hacían ILEGIBLES aunque se vieran bien en pantalla:
 *
 * 1. `marginSize={2}`. La zona de silencio del estándar QR son 4 módulos; con 2,
 *    un lector de móvil no encuentra dónde empieza el código. En la herramienta
 *    pública el fallo no se nota porque su tarjeta ya es blanca y el blanco
 *    sigue; aquí el panel es OSCURO y el blanco del QR se cortaba en seco a dos
 *    módulos del patrón.
 * 2. El contenedor usaba `bg-panel-surface`, que en tema oscuro es casi negro.
 *
 * Y el PNG que se descargaba salía del canvas de pantalla: 300 px, que puesto en
 * un cartel de recepción sale pixelado. La descarga ahora se genera aparte a
 * 1024 px, que aguanta impresión.
 */
export function QrCompartir({
  valor,
  titulo,
  archivo,
}: {
  valor: string;
  titulo: string;
  archivo: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function descargar() {
    const canvas = ref.current?.querySelector("canvas") as HTMLCanvasElement | null;
    if (!canvas) return;
    // Se reescala a 1024 px con suavizado apagado: un QR es geometría, no foto,
    // y el suavizado le come el filo a los módulos.
    const LADO = 1024;
    const grande = document.createElement("canvas");
    grande.width = LADO;
    grande.height = LADO;
    const ctx = grande.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, LADO, LADO);
    ctx.drawImage(canvas, 0, 0, LADO, LADO);

    const a = document.createElement("a");
    a.href = grande.toDataURL("image/png");
    a.download = archivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="text-center">
      {/* Fondo BLANCO siempre, también en tema oscuro: es parte del código. */}
      <div
        ref={ref}
        className="inline-flex rounded-xl border border-panel-border-soft bg-white p-3"
      >
        <QRCodeCanvas
          value={valor}
          size={150}
          bgColor="#FFFFFF"
          fgColor="#1B4332"
          level="M"
          marginSize={4}
        />
      </div>
      <p className="mt-2 text-xs font-semibold text-kora-text">{titulo}</p>
      <button
        type="button"
        onClick={descargar}
        className="btn-press mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-panel-border text-kora-text text-sm font-semibold hover:border-kora-accent transition-colors"
      >
        <Download size={14} /> Descargar
      </button>
    </div>
  );
}

