// La secuencia de la guía: los 5 correos que recibe quien dejó SÓLO su correo.
//
// Distinta a propósito de la secuencia de leads (templates.ts). Aquella le
// escribe a alguien que ya dio su WhatsApp y pidió que le hablen, así que vende
// desde el primer renglón. Ésta le escribe a un desconocido que quería una
// guía: los correos 1, 2 y 3 no venden nada. Se gana el derecho a la venta del
// correo 5 entregando algo utilizable en los cuatro anteriores.
//
// El pie de TODOS lleva el link de baja. Ver lib/suscriptores.ts.
//
// SOLO se generan strings HTML (sin acceso a BD ni a env de servidor).

import {
  T as TOK,
  FONT,
  doc,
  esc,
  cabecera,
  titulo,
  saludo,
  parrafo,
  boton,
  caja,
  lista,
  pieKora,
  respiro,
  etiqueta,
} from "@/lib/email/design";
import { urlBaja, primerNombre, type ToqueGuia } from "@/lib/suscriptores";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";

/** El pie con la baja de un clic. Obligatorio en todos los de esta secuencia. */
function pieConBaja(token: string): string {
  return pieKora(
    `Recibes esto porque pediste el Plan de 90 días en kora-hotel.com. ` +
      `<a href="${urlBaja(token)}" style="color:#b8aa9a;text-decoration:underline;">Darme de baja</a>.`,
  );
}

/** Firma de Manolo. La secuencia la manda una persona, no "el equipo". */
const firma = parrafo(
  `— Manolo Covarrubias<br>` +
    `<span style="color:${TOK.tenue};font-size:13px;">Hotel Paraíso Encantado, Xilitla · Fundador de Kora</span>`,
);

export interface DatosGuia {
  nombre?: string | null;
  token: string;
}

// ─── Toque 0 · al instante: la entrega ───────────────────────────────────────
// El único trabajo de este correo es que la guía llegue y se abra. La pregunta
// del final busca respuestas: un correo respondido es la señal más fuerte que
// existe para que Gmail mande los siguientes a la bandeja principal.

function guia0({ nombre, token }: DatosGuia) {
  const first = primerNombre(nombre);
  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Tu guía está lista" }) +
    titulo("El Plan de 90 días") +
    saludo(
      "Hola",
      esc(first),
      `Aquí está lo que pediste. Es el plan que seguí en mi propio hotel, semana por semana, sin adornos.`,
    ) +
    parrafo(
      `No es teoría de conferencia. Tengo un hotel en Xilitla, San Luis Potosí, y en tres meses bajé la parte de mis reservas que llegaba por OTAs <strong style="color:${TOK.tinta};">del 40% al 25%</strong>. Eso es lo que está escrito aquí.`,
    ) +
    boton(`${SITE}/guia`, "Abrir el plan de 90 días") +
    lista("Lo que vas a encontrar", [
      "Las 12 semanas, una por una, con qué hacer en cada una",
      "Las 3 plantillas de WhatsApp que más me sirvieron, para copiar y pegar",
      "Cómo sacar tu número real de dependencia antes de empezar",
      "Los dos errores que me costaron el primer mes",
    ]) +
    respiro +
    parrafo(
      `Una cosa más: en los próximos días te voy a mandar cuatro correos cortos con lo que no cabe en la guía. Si en algún momento sobran, abajo hay un link para darte de baja en un clic — sin rencores.`,
    ) +
    caja(
      `<strong>¿Me haces un favor?</strong> Respóndeme este correo con cuántas habitaciones tienes. Leo todas las respuestas y me sirve para mandarte cosas que apliquen a tu tamaño de hotel.`,
      "neutro",
    ) +
    firma +
    respiro +
    pieConBaja(token);

  return {
    subject: "Tu Plan de 90 días (y cómo bajé del 40% al 25%)",
    html: doc(
      "El Plan de 90 días — Kora",
      "El plan que seguí en mi hotel para bajar la dependencia de las OTAs del 40% al 25%.",
      inner,
    ),
  };
}

// ─── Toque 2 · la cuenta ─────────────────────────────────────────────────────
// Valor puro. Cero producto. El objetivo es que haga la cuenta y se asuste con
// su propio número, no con uno mío.

function guia2({ nombre, token }: DatosGuia) {
  const first = primerNombre(nombre);
  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Correo 2 de 5" }) +
    titulo("La cuenta que casi nadie hace") +
    saludo(
      "Hola",
      esc(first),
      `Casi todos los hoteleros que conozco saben que Booking les cobra "como 15%". Casi ninguno sabe cuánto es eso al año en pesos. Y son dos sensaciones muy distintas.`,
    ) +
    parrafo(`La cuenta es de una línea:`) +
    caja(
      `<strong>Reservas de OTA al mes × tarifa promedio × noches promedio × comisión × 12</strong>`,
      "neutro",
    ) +
    parrafo(
      `Un hotel de 12 habitaciones que recibe 40 reservas de OTA al mes, a $1,800 la noche, con 1.8 noches de estancia promedio y 16% de comisión, paga <strong style="color:${TOK.tinta};">alrededor de $248,000 al año</strong>. No en cinco años: cada año.`,
    ) +
    parrafo(
      `Ese número es la razón por la que existe la guía que te mandé. Pero antes de moverle nada, saca <em>tu</em> número. Si te da flojera hacer la multiplicación, tengo una calculadora gratis que la hace sola:`,
    ) +
    boton(`${SITE}/herramientas/calculadora-comisiones`, "Sacar mi número") +
    respiro +
    parrafo(
      `Un aviso honesto: el objetivo <strong>no</strong> es salirte de Booking. Booking te trae gente que nunca te habría encontrado, y eso vale. El objetivo es que el huésped que ya te vio en Instagram o en Google no se vaya a buscarte a la OTA para reservar. Ese es el que estás pagando de más.`,
    ) +
    firma +
    respiro +
    pieConBaja(token);

  return {
    subject: `${first}, ¿cuánto pagaste de comisiones el año pasado?`,
    html: doc(
      "La cuenta que casi nadie hace — Kora",
      "Reservas de OTA × tarifa × noches × comisión × 12. El número asusta más de lo que parece.",
      inner,
    ),
  };
}

// ─── Toque 5 · las plantillas ────────────────────────────────────────────────
// Valor puro otra vez, pero esta vez copiable. Que pueda usar algo HOY mismo.

function guia5({ nombre, token }: DatosGuia) {
  const first = primerNombre(nombre);
  const plantilla = (t: string, cuerpo: string) =>
    `<tr><td style="padding:14px 40px 0;">
      ${etiqueta(t)}
      <div style="background:#f3efe7;border:1px solid ${TOK.borde};border-radius:12px;padding:14px 16px;font-family:${FONT};font-size:13.5px;color:${TOK.cuerpo};line-height:1.7;">${cuerpo}</div>
    </td></tr>`;

  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Correo 3 de 5" }) +
    titulo("Las 3 frases de WhatsApp que más me cambiaron el mes") +
    saludo(
      "Hola",
      esc(first),
      `De todo lo que probé, lo que más reservas directas me trajo no fue una herramienta: fue dejar de improvisar los mensajes. Estas tres son las que uso. Cópialas tal cual.`,
    ) +
    plantilla(
      "1 · Cuando preguntan precio (no contestes sólo el número)",
      `"Hola [nombre], claro que sí. Para esas fechas tengo la [habitación] en <strong>$X la noche</strong>, incluye [lo que incluye].<br><br>Te la puedo apartar hoy con el 30% y el resto lo pagas al llegar. ¿Te la aparto?"`,
    ) +
    plantilla(
      "2 · Cuando no contestaron en 24 h",
      `"Hola [nombre], sigo con la [habitación] libre para el [fecha], pero se me está moviendo el fin de semana. ¿Todavía la quieres o la libero?"`,
    ) +
    plantilla(
      "3 · Tres días antes de que lleguen",
      `"[nombre], ya casi. Los espero el [fecha] a partir de las 3 pm.<br>Aquí está cómo llegar: [link].<br>¿Vienen en coche o los recojo en la central?"`,
    ) +
    respiro +
    parrafo(
      `Por qué funcionan: la primera cierra en vez de informar. La segunda usa escasez <strong>real</strong> (si mientes, se nota y pierdes al huésped). La tercera te compra el permiso de mandarle un mensaje más — y es donde se venden los extras.`,
    ) +
    parrafo(
      `Si quieres estos mensajes ya armados con los datos de tu hotel, tengo un generador gratis: <a href="${SITE}/herramientas/mensajes-whatsapp" style="color:${TOK.verde};font-weight:600;text-decoration:none;">kora-hotel.com/herramientas/mensajes-whatsapp</a>`,
    ) +
    firma +
    respiro +
    pieConBaja(token);

  return {
    subject: "3 mensajes de WhatsApp para copiar y pegar hoy",
    html: doc(
      "Las 3 frases de WhatsApp — Kora",
      "Cotizar, recuperar al que no contestó y preparar la llegada. Listos para copiar.",
      inner,
    ),
  };
}

// ─── Toque 9 · el caso ───────────────────────────────────────────────────────
// Primera vez que aparece Kora, y aparece como consecuencia de la historia, no
// como el tema. La cifra es la real y verificada: 40% → 25% en 3 meses.

function guia9({ nombre, token }: DatosGuia) {
  const first = primerNombre(nombre);
  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Correo 4 de 5" }) +
    titulo("Lo que sí movió la aguja en mi hotel") +
    saludo(
      "Hola",
      esc(first),
      `Te debo el detalle. En tres meses pasé del 40% al 25% de dependencia de OTAs en el Paraíso Encantado. No fue una sola cosa; fueron tres, en este orden.`,
    ) +
    lista("Las tres, por orden de impacto", [
      "<strong>1. Una página propia donde de verdad se pueda reservar.</strong> No un formulario de contacto: reservar, pagar y recibir la confirmación sin que yo tenga que estar.",
      "<strong>2. Contestar en minutos, no en horas.</strong> El 60% de los mensajes llegaban fuera de horario. Ahí se perdían casi todos.",
      "<strong>3. Pedir la reseña siempre, el día correcto.</strong> Al día siguiente de que se van, no una semana después.",
    ]) +
    respiro +
    caja(
      `El error que me costó el primer mes: bajar precios en mi propia página para "ganarle" a Booking. Booking lo detecta y te castiga la posición. El directo no se gana con precio, se gana con lo que le das al huésped que reserva contigo (late check-out, un upgrade, algo que la OTA no puede vender).`,
      "alerta",
    ) +
    parrafo(
      `Los puntos 1 y 2 los terminé construyendo yo porque no encontré nada hecho para un hotel de mi tamaño y a un precio de un hotel de mi tamaño. Eso es <strong style="color:${TOK.tinta};">Kora</strong>: la página de reservas, el cobro con tarjeta y OXXO directo a tu cuenta, y un agente de WhatsApp que contesta a las 2 de la mañana.`,
    ) +
    parrafo(
      `Mañana no te escribo. Pasado te mando el último correo con la invitación y ya no te molesto más con esto.`,
    ) +
    firma +
    respiro +
    pieConBaja(token);

  return {
    subject: "Del 40% al 25%: las 3 cosas, en orden",
    html: doc(
      "Lo que sí movió la aguja — Kora",
      "Las tres cosas que bajaron mi dependencia de OTAs, y el error que me costó el primer mes.",
      inner,
    ),
  };
}

// ─── Toque 14 · la invitación ────────────────────────────────────────────────
// El único que vende. Y se despide: la secuencia se apaga sola aquí.

function guia14({ nombre, token }: DatosGuia) {
  const first = primerNombre(nombre);
  const inner =
    cabecera({ nombre: "Kora", eyebrow: "Correo 5 de 5" }) +
    titulo("El último, y ya te dejo en paz") +
    saludo(
      "Hola",
      esc(first),
      `Este es el último correo de la serie. Si la guía te sirvió y quieres armarlo tú solo, adelante — en serio, para eso la escribí.`,
    ) +
    parrafo(
      `Si prefieres no armarlo tú, Kora es lo que yo hubiera querido encontrar hace dos años:`,
    ) +
    lista("Lo que queda listo el primer día", [
      "Tu página de reservas con tus cuartos, tus precios y tus fotos",
      "Cobro con tarjeta y OXXO, directo a tu cuenta de banco",
      "Un agente de WhatsApp que cotiza y aparta a cualquier hora",
      "Los correos automáticos al huésped: confirmación, llegada y reseña",
    ]) +
    caja(
      `<strong>$550 MXN al mes.</strong> Fijo. Sin comisión por reserva, sin contrato y sin costo de instalación. Los primeros 30 días no se cobran. Si con una reserva directa al mes ya lo pagaste, el resto del año es tuyo.`,
      "exito",
    ) +
    boton(`${SITE}/precios`, "Ver cómo funciona") +
    respiro +
    parrafo(
      `Si prefieres platicarlo antes, respóndeme este correo y te contesto yo. No hay vendedor, no hay llamada agendada, no hay demo de 45 minutos.`,
    ) +
    parrafo(
      `Y si esto no es para ti, no pasa nada: <a href="${urlBaja(token)}" style="color:${TOK.verde};font-weight:600;text-decoration:none;">date de baja aquí</a> y no vuelves a saber de mí. Gracias por leer hasta acá.`,
    ) +
    firma +
    respiro +
    pieConBaja(token);

  return {
    subject: `${first}, el último correo (y una invitación)`,
    html: doc(
      "La invitación — Kora",
      "$550 al mes, 30 días sin cobro y sin contrato. O quédate con la guía y armalo tú.",
      inner,
    ),
  };
}

// ─── Despachador ─────────────────────────────────────────────────────────────

const PLANTILLAS: Record<ToqueGuia, (d: DatosGuia) => { subject: string; html: string }> = {
  guia_0: guia0,
  guia_2: guia2,
  guia_5: guia5,
  guia_9: guia9,
  guia_14: guia14,
};

/** El correo que toca. El cron y /api/suscribir pasan por aquí. */
export function emailGuia(toque: ToqueGuia, datos: DatosGuia) {
  return PLANTILLAS[toque](datos);
}
