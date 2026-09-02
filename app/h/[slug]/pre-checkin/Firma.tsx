"use client";

import { useEffect, useRef, useState } from "react";

// Firma con el dedo, sin ninguna librería.
//
// Son ~80 líneas de canvas y eventos de puntero; meter una dependencia por esto
// añadiría peso a una página que se abre en el celular del huésped, con la señal
// del hotel, y muchas veces desde el estacionamiento.
//
// Detalles que sólo se ven probándolo en un teléfono de verdad:
// - `touch-action: none` en el lienzo, o el navegador hace scroll de la página
//   en vez de dejar dibujar.
// - Pointer Events y no touch/mouse por separado: cubre dedo, lápiz y ratón con
//   un solo camino, y con `setPointerCapture` el trazo no se corta si el dedo se
//   sale del lienzo.
// - El lienzo se dibuja a la resolución REAL de la pantalla
//   (`devicePixelRatio`), o la firma sale pixelada en un móvil moderno.

export function Firma({ onChange }: { onChange: (dataUri: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [tieneTrazo, setTieneTrazo] = useState(false);

  useEffect(() => {
    const lienzo = ref.current;
    if (!lienzo) return;
    const dpr = window.devicePixelRatio || 1;
    const caja = lienzo.getBoundingClientRect();
    lienzo.width = caja.width * dpr;
    lienzo.height = caja.height * dpr;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  function punto(e: React.PointerEvent<HTMLCanvasElement>) {
    const caja = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - caja.left, y: e.clientY - caja.top };
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const p = punto(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const p = punto(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!tieneTrazo) setTieneTrazo(true);
  }

  function terminar() {
    if (!dibujando.current) return;
    dibujando.current = false;
    const lienzo = ref.current;
    if (lienzo) onChange(lienzo.toDataURL("image/png"));
  }

  function limpiar() {
    const lienzo = ref.current;
    const ctx = lienzo?.getContext("2d");
    if (!lienzo || !ctx) return;
    ctx.clearRect(0, 0, lienzo.width, lienzo.height);
    setTieneTrazo(false);
    onChange("");
  }

  return (
    <div>
      <canvas
        ref={ref}
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerLeave={terminar}
        onPointerCancel={terminar}
        className="w-full rounded-xl border border-dashed border-gray-300 bg-gray-50"
        style={{ height: 140, touchAction: "none" }}
        aria-label="Firma aquí con el dedo"
      />
      <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
        <span>{tieneTrazo ? "Firmado" : "Firma aquí con el dedo"}</span>
        {tieneTrazo && (
          <button type="button" onClick={limpiar} className="underline">
            Borrar y volver a firmar
          </button>
        )}
      </div>
    </div>
  );
}
