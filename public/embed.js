/* Kora — motor de reservas embebible.
 *
 * Uso (una línea en el sitio del hotel):
 *   <script src="https://kora-hotel.com/embed.js" data-hotel="mi-hotel"></script>
 *
 * Inyecta un <iframe> con el motor de reservas del hotel en el lugar del script.
 * Vanilla JS, sin dependencias.
 */
(function () {
  // `document.currentScript` apunta al <script> que está ejecutándose ahora.
  var script = document.currentScript;
  if (!script) {
    // Fallback: último <script> con data-hotel.
    var all = document.querySelectorAll("script[data-hotel]");
    script = all[all.length - 1];
  }
  if (!script) return;

  var slug = (script.getAttribute("data-hotel") || "").trim();
  if (!slug) {
    console.error("[Kora embed] Falta el atributo data-hotel en el <script>.");
    return;
  }

  // Origen = de dónde se sirvió este script (kora-hotel.com en producción).
  var origin = new URL(script.src, window.location.href).origin;

  var iframe = document.createElement("iframe");
  iframe.src = origin + "/h/" + encodeURIComponent(slug) + "/reservar";
  iframe.title = "Motor de reservas";
  iframe.loading = "lazy";
  iframe.setAttribute("allow", "payment");
  iframe.style.width = "100%";
  iframe.style.border = "0";
  iframe.style.minHeight = "720px";
  iframe.style.display = "block";

  // Insertar el iframe justo antes del <script> (en su posición en el flujo).
  script.parentNode.insertBefore(iframe, script);
})();
