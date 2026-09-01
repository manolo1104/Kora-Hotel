// El `?next=` de `/entrar` y del enlace mágico lo escribe quien manda el enlace,
// no nosotros. Si acepta un destino externo se convierte en un open-redirect: un
// correo con `https://kora-hotel.com/entrar?next=//sitio-del-atacante/entrar`
// SALE DE NUESTRO DOMINIO —el que el hotelero reconoce— y aterriza en una copia
// del formulario de acceso. Es la forma más barata de robar una contraseña,
// porque el enlace es genuinamente nuestro.
//
// Había dos comprobaciones para la misma regla y no decían lo mismo: la de
// `/entrar` rechazaba `/\` y la de `auth/callback` —justo la que recibe el
// enlace POR CORREO— no (K-18.6).
import { describe, it, expect } from "vitest";
import { destinoSeguro } from "@/lib/destino-seguro";

describe("destinos que apuntan fuera", () => {
  const FUERA = [
    ["protocolo relativo", "//sitio-del-atacante.com/entrar"],
    ["barra invertida, que varios navegadores tratan como //", "/\\sitio-del-atacante.com"],
    ["barra invertida doble", "/\\\\sitio-del-atacante.com"],
    ["URL absoluta", "https://sitio-del-atacante.com"],
    ["URL absoluta sin esquema explícito", "http://sitio-del-atacante.com"],
    ["javascript:", "javascript:alert(1)"],
    ["data:", "data:text/html,<script>alert(1)</script>"],
    ["con credenciales", "//user:pass@sitio-del-atacante.com"],
    ["sin barra inicial", "sitio-del-atacante.com"],
    ["vacío", ""],
  ];

  for (const [que, valor] of FUERA) {
    it(`rechaza ${que}`, () => {
      expect(destinoSeguro(valor)).toBe(null);
    });
  }

  it("rechaza null y undefined sin tronar", () => {
    expect(destinoSeguro(null)).toBe(null);
    expect(destinoSeguro(undefined)).toBe(null);
  });

  it("rechaza un destino absurdamente largo", () => {
    // Dos kilobytes no son un destino: son alguien probando.
    expect(destinoSeguro("/" + "a".repeat(600))).toBe(null);
  });
});

describe("destinos internos, que tienen que seguir funcionando", () => {
  const DENTRO = [
    "/panel",
    "/panel/hotel-magico/reservas",
    "/panel/hotel-magico/camila?paso=6",
    "/precios#planes",
    "/",
  ];

  for (const v of DENTRO) {
    it(`acepta ${v}`, () => {
      expect(destinoSeguro(v)).toBe(v);
    });
  }

  it("devuelve la ruta ya normalizada, lista para pegar tras el origen", () => {
    // El parser resuelve `..` igual que lo haría el navegador, así que lo que
    // sale no puede escaparse del origen por mucho que se retroceda.
    expect(destinoSeguro("/panel/../precios")).toBe("/precios");
    expect(destinoSeguro("/../../../etc/passwd")).toBe("/etc/passwd");
  });

  it("una barra CODIFICADA no escapa, así que se acepta", () => {
    // `/%2F%2Fmalo.com` parece `//malo.com` pero no lo es: ni el parser ni el
    // navegador decodifican `%2F` como separador de ruta, así que resuelve a una
    // ruta interna con ese nombre literal. Rechazarlo sería un falso positivo.
    expect(destinoSeguro("/%2F%2Fsitio-del-atacante.com")).toBe(
      "/%2F%2Fsitio-del-atacante.com",
    );
  });

  it("conserva query y hash", () => {
    expect(destinoSeguro("/panel?hotel=magico#pagos")).toBe("/panel?hotel=magico#pagos");
  });
});
