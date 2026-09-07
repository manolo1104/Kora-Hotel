// Qué hace Camila cuando el huésped manda algo que no es texto.
//
// Salió de un log real: de siete mensajes al primer hotel conectado, TRES no
// eran texto —dos respuestas a botones y una tarjeta de contacto— y el bot los
// dejó en visto. Lo que se prueba aquí es que ninguna de esas tres formas de
// equivocarse vuelva: ignorar a quien contestó a un botón, callarse ante un
// audio, o ponerse a contestarle a los avisos del propio WhatsApp.
import { describe, it, expect } from "vitest";
import { clasificar, respuestaSinSoporte, comoSeVeEnElPanel } from "../agentes/camila/medios.js";

describe("una respuesta a un botón NO es basura", () => {
  // Es lo peor de ignorar: el huésped contestó a algo que preguntamos nosotros.
  it("los botones y listas se tratan como texto", () => {
    for (const t of ["interactive", "buttons_response", "list_response", "template_button_reply", "native_flow"]) {
      expect(clasificar(t, "Quiero reservar"), t).toBe("texto");
    }
  });

  it("un botón sin texto aprovechable no dispara un aviso absurdo", () => {
    expect(clasificar("interactive", "")).toBe("ignorar");
  });
});

describe("una foto CON pie de foto es un mensaje", () => {
  it("el pie se aprovecha como texto", () => {
    expect(clasificar("image", "¿tienen algo así?")).toBe("texto");
    expect(clasificar("document", "aquí va mi comprobante")).toBe("texto");
  });

  it("sin pie, se avisa de que no se puede ver", () => {
    expect(clasificar("image", "")).toBe("sin-soporte");
  });
});

describe("lo que de verdad no se puede leer", () => {
  it("audios, ubicaciones y contactos se contestan, no se ignoran", () => {
    for (const t of ["ptt", "audio", "location", "vcard", "multi_vcard", "sticker", "video"]) {
      expect(clasificar(t, ""), t).toBe("sin-soporte");
    }
  });

  it("el aviso dice que llegó, qué no puede hacer, y por dónde seguir", () => {
    const r = respuestaSinSoporte("ptt");
    expect(r).toContain("Me llegó tu nota de voz");
    expect(r).toContain("no puedo escuchar");
    expect(r).toContain("por escrito");
  });

  it("cada tipo se llama por su nombre, no «un archivo multimedia»", () => {
    expect(respuestaSinSoporte("location")).toContain("tu ubicación");
    expect(respuestaSinSoporte("vcard")).toContain("contacto");
    expect(respuestaSinSoporte("image")).toContain("tu foto");
  });

  // La trampa que ya costó un fallo: mandar al huésped al MISMO WhatsApp desde
  // el que le estás escribiendo. Esa decisión vive en el prompt, no aquí.
  it("el aviso NO da ningún número de teléfono", () => {
    for (const t of ["ptt", "image", "location", "vcard"]) {
      expect(respuestaSinSoporte(t), t).not.toMatch(/\d{7,}/);
    }
  });

  it("un tipo desconocido no rompe nada", () => {
    expect(clasificar("algo_que_no_existe", "")).toBe("sin-soporte");
    expect(respuestaSinSoporte("algo_que_no_existe")).toContain("lo que me mandaste");
  });
});

describe("el ruido del propio WhatsApp se calla", () => {
  it("avisos de cifrado, grupos, reacciones y llamadas no se contestan", () => {
    for (const t of [
      "e2e_notification", "notification", "notification_template", "group_notification",
      "groups_v4_invite", "gp2", "call_log", "broadcast_notification", "ciphertext",
      "debug", "protocol", "reaction", "revoked", "unknown", "poll_creation",
    ]) {
      expect(clasificar(t, ""), t).toBe("ignorar");
    }
  });

  // Un mensaje borrado llega con cuerpo a veces; contestarlo sería raro.
  it("ni aunque traigan cuerpo", () => {
    expect(clasificar("revoked", "algo")).toBe("ignorar");
    expect(clasificar("reaction", "👍")).toBe("ignorar");
  });
});

describe("el hotelero ve en la bandeja que llegó algo", () => {
  // En la bandeja se habla del huésped en tercera persona. Con los nombres que
  // se le dicen a él salía «el huésped mandó TU nota de voz».
  it("se guarda en tercera persona, no tuteando al hotelero", () => {
    expect(comoSeVeEnElPanel("ptt")).toBe("[el huésped mandó una nota de voz]");
    expect(comoSeVeEnElPanel("location")).toBe("[el huésped mandó su ubicación]");
    for (const t of ["ptt", "audio", "image", "video", "document", "vcard"]) {
      expect(comoSeVeEnElPanel(t), t).not.toContain(" tu ");
    }
  });

  it("y al huésped sí se le tutea", () => {
    expect(respuestaSinSoporte("ptt")).toContain("tu nota de voz");
  });

  it("un tipo raro también deja rastro, con el tipo dentro", () => {
    expect(comoSeVeEnElPanel("rarísimo")).toContain("rarísimo");
  });
});
