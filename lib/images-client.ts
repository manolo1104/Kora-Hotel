// Utilidades de imagen del lado del NAVEGADOR (client-only). Compartidas por el
// editor del panel (PanelEditor) y el asistente de configuración (Onboarding),
// para que TODO lo que se suba pase por la misma compresión y el motor cargue
// más rápido.

/**
 * Comprime/redimensiona una imagen EN EL NAVEGADOR antes de subirla: la escala a
 * máx. `maxDim` px por lado y la exporta a WebP. Si algo falla o no es una imagen
 * rasterizable (SVG/GIF), devuelve el archivo original — nunca bloquea la subida.
 * Reduce mucho el peso → el motor de reservas y la mini-página cargan más rápido.
 */
export async function comprimirImagen(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  const t = file.type;
  if (!t.startsWith("image/") || t === "image/svg+xml" || t === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * escala));
    const h = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), "image/webp", quality)
    );
    // Solo usar la comprimida si de verdad pesa menos (fotos ya pequeñas no ganan).
    return blob && blob.size > 0 && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/**
 * Deriva nombre y extensión de destino para una foto ya comprimida. Centraliza
 * la convención de rutas del bucket "fotos" para no repetirla en cada subida.
 */
export function nombreArchivoSubida(file: File, blob: Blob): { path: string; contentType: string } {
  const esWebp = blob !== file && blob.type === "image/webp";
  const base = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9]/g, "_");
  const ext = esWebp ? "webp" : (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "");
  const rnd = Math.random().toString(36).slice(2, 6);
  return {
    path: `${Date.now()}-${rnd}-${base}.${ext}`,
    contentType: esWebp ? "image/webp" : file.type || "application/octet-stream",
  };
}
