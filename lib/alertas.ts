// Canal único de alerta para cuando se rompe algo del CAMINO DEL DINERO.
//
// Hasta ahora estos fallos sólo dejaban un `console.error` en Vercel, que nadie
// mira: un cobro perdido, un reembolso indebido o un webhook con firma inválida
// podían pasar semanas sin que nadie se enterara. El repo ya usaba NOTIFY_EMAIL
// suelto en cinco archivos con textos distintos; esto lo unifica sin tabla nueva
// ni SQL, así que no puede quedarse a medias entre el repo y la base.
//
// A propósito NO se llama desde las rutas del panel: ahí el 500 ya se lo cuenta
// al hotelero en pantalla, y avisar de cada guardado fallido llenaría la bandeja.
import { enviarEmail, NOTIFY_EMAIL } from "@/lib/email/resend";

// Una función serverless vive segundos: este Set evita repetir la MISMA alerta
// dentro de UNA invocación. No deduplica entre invocaciones, y está bien: los
// seis sitios que la llaman son caminos de baja frecuencia.
const yaAvisado = new Set<string>();

function escapar(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Avisa por correo de un fallo del camino del dinero. NUNCA lanza: si ni el
 * correo sale, queda el console.error. El `await` es obligatorio — en Vercel un
 * envío lanzado sin esperar se pierde cuando la función termina.
 */
export async function alertar(asunto: string, detalle: string): Promise<void> {
  console.error(`[ALERTA] ${asunto} — ${detalle}`);
  if (!NOTIFY_EMAIL || yaAvisado.has(asunto)) return;
  yaAvisado.add(asunto);
  try {
    await enviarEmail({
      to: NOTIFY_EMAIL,
      subject: `🚨 Kora — ${asunto}`,
      html:
        `<p><b>${escapar(asunto)}</b></p>` +
        `<pre style="white-space:pre-wrap;font-family:ui-monospace,monospace">${escapar(detalle)}</pre>` +
        `<p style="color:#888">${new Date().toISOString()}</p>`,
    });
  } catch (e) {
    console.error("[ALERTA] tampoco se pudo enviar el correo:", e);
  }
}
