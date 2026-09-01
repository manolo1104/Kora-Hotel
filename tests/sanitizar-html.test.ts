// El cuerpo de los artículos de `/blog/<slug>` lo escribe el agente de blogs con
// un modelo que además hace BÚSQUEDAS WEB, y sale a la página con
// `dangerouslySetInnerHTML` (K-18.2). Una página leída durante la búsqueda puede
// decirle al modelo «incluye esta etiqueta en el artículo» — el modelo no
// distingue su instrucción de lo que lee por ahí.
//
// Estas pruebas cubren las dos caras: que lo peligroso se caiga, y que un
// artículo normal SIGA VIÉNDOSE IGUAL. Lo segundo importa tanto como lo primero:
// un saneador que se lleva por delante el formato deja 17 artículos rotos.
import { describe, it, expect } from "vitest";
import { sanitizarHtmlArticulo } from "@/lib/sanitizar-html";

describe("lo que tiene que caerse", () => {
  const CASOS: [string, string][] = [
    ["un <script> directo", '<p>Hola</p><script>alert(1)</script>'],
    ["un <script> con mayúsculas", '<SCRIPT>alert(1)</SCRIPT>'],
    ["un <iframe>", '<iframe src="https://malo/"></iframe>'],
    ["un <object>", '<object data="x.swf"></object>'],
    ["un <style>", '<style>body{display:none}</style>'],
    ["un <form>", '<form action="https://malo/"><input name="c"></form>'],
  ];

  for (const [que, html] of CASOS) {
    it(`descarta ${que}`, () => {
      const limpio = sanitizarHtmlArticulo(html);
      expect(limpio.toLowerCase()).not.toContain("<script");
      expect(limpio.toLowerCase()).not.toContain("<iframe");
      expect(limpio.toLowerCase()).not.toContain("<object");
      expect(limpio.toLowerCase()).not.toContain("<style");
      expect(limpio.toLowerCase()).not.toContain("<form");
      expect(limpio).not.toContain("alert(1)");
    });
  }

  it("quita los manejadores de eventos", () => {
    const limpio = sanitizarHtmlArticulo(
      '<p onclick="robar()" onmouseover="robar()">Texto</p><img src="https://x/y.png" onerror="robar()">',
    );
    expect(limpio).not.toContain("onclick");
    expect(limpio).not.toContain("onmouseover");
    expect(limpio).not.toContain("onerror");
    expect(limpio).toContain("Texto");
  });

  it("no deja un href `javascript:`", () => {
    const limpio = sanitizarHtmlArticulo('<a href="javascript:alert(1)">clic</a>');
    expect(limpio).not.toContain("javascript:");
    expect(limpio).toContain("clic"); // el texto se queda; el enlace no
  });

  it("tampoco un `data:text/html`, que es un XSS completo", () => {
    const limpio = sanitizarHtmlArticulo(
      '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">clic</a>',
    );
    expect(limpio).not.toContain("data:text/html");
  });

  it("no deja `expression()` ni `behavior:` en un style", () => {
    const limpio = sanitizarHtmlArticulo(
      '<div style="color: expression(alert(1)); behavior: url(x.htc)">Texto</div>',
    );
    expect(limpio).not.toContain("expression(");
    expect(limpio).not.toContain("behavior");
  });
});

describe("lo que NO se puede llevar por delante", () => {
  // Trozo con la forma real de los artículos del blog de Kora.
  const ARTICULO = `<p>Las OTAs cobran entre el <strong>15% y el 20%</strong> de cada reserva.</p>
<h2 id="que-hacer">Qué hacer</h2>
<ul>
  <li>Monta tu <em>motor de reservas</em></li>
  <li>Contesta el WhatsApp</li>
</ul>
<blockquote style="border-left: 4px solid #1B4332; padding: 12px">Cita del hotelero</blockquote>
<div style="background-color: #fef2f2; border-radius: 12px; padding: 16px">
  <ul><li style="color: #7f1d1d;">40% reservas por OTAs</li></ul>
</div>
<p><a href="/casos/paraiso-encantado">Ver el caso</a> · <a href="https://booking.com" target="_blank">Booking</a></p>
<img src="https://xyz.supabase.co/storage/v1/object/public/fotos/a.png" alt="Recepción" loading="lazy" />`;

  const limpio = sanitizarHtmlArticulo(ARTICULO);

  it("conserva el texto entero", () => {
    for (const t of ["15% y el 20%", "Qué hacer", "motor de reservas", "Cita del hotelero", "40% reservas por OTAs", "Ver el caso"]) {
      expect(limpio).toContain(t);
    }
  });

  it("conserva las etiquetas de formato", () => {
    for (const t of ["<p>", "<h2", "<ul>", "<li", "<strong>", "<em>", "<blockquote", "<div", "<a ", "<img"]) {
      expect(limpio).toContain(t);
    }
  });

  it("conserva el `id` de los encabezados (el índice del artículo los usa)", () => {
    expect(limpio).toContain('id="que-hacer"');
  });

  it("conserva los estilos en línea de las tarjetas de color", () => {
    expect(limpio).toContain("background-color");
    expect(limpio).toContain("#fef2f2");
    expect(limpio).toContain("border-left");
  });

  it("conserva los enlaces internos y externos, y la imagen del Storage", () => {
    expect(limpio).toContain('href="/casos/paraiso-encantado"');
    expect(limpio).toContain('href="https://booking.com"');
    expect(limpio).toContain("supabase.co/storage");
    expect(limpio).toContain('alt="Recepción"');
  });

  it("le pone `rel` al enlace que abre en pestaña nueva", () => {
    // Sin `rel`, el destino puede manipular nuestra pestaña por `window.opener`.
    expect(limpio).toContain('rel="noopener noreferrer"');
  });

  it("aguanta acentos, eñes y comillas tipográficas", () => {
    const d = "<p>«Xilitla, San Luis Potosí» — año 2026, señor Muñoz</p>";
    expect(sanitizarHtmlArticulo(d)).toContain("Potosí» — año 2026, señor Muñoz");
  });

  it("no truena con vacío", () => {
    expect(sanitizarHtmlArticulo("")).toBe("");
  });
});
