// Corrige en la base los tres artículos del blog que prometen funciones que Kora
// NO tiene. Los escribió el agente de blog y viven en `blog_articles`, no en el
// repo: por eso la limpieza de promesas del 15 sep 2026 pasó por encima de ellos.
//
// Lo que prometían (comprobado en producción el 15 sep 2026):
//   · channel manager  → «En Kora, la sincronización de calendarios OTA vía iCal
//                         viene incluida sin costo extra» (x3).
//   · overbooking      → «Kora conecta tus OTAs en un solo calendario».
//   · Google Hotels    → «Kora conecta tu motor de reservas a Google».
// Ninguna de las tres existe. Y son peores que una exageración: atraen justo al
// hotelero que quiere lo que Kora no hace, que se registra y se va enojado.
//
//   ENSAYO (no escribe nada):
//     node --env-file=.env.local scripts/corregir-blog.mjs
//   APLICAR:
//     node --env-file=.env.local scripts/corregir-blog.mjs --enviar
//
// Es idempotente: si el texto viejo ya no está y el nuevo sí, lo dice y no toca
// nada. Lo corre Manolo: el agente tiene bloqueada la escritura en producción.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ENVIAR = process.argv.includes("--enviar");

if (!URL || !KEY) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(URL, KEY, { auth: { persistSession: false } });

/** Cada cambio: el texto tal cual está hoy y el que lo sustituye. */
const CAMBIOS = [
  {
    slug: "channel-manager-que-es-cuando-lo-necesitas-y-cuanto-cuesta",
    reemplazos: [
      {
        viejo:
          "En Kora, la sincronización de calendarios OTA vía iCal viene incluida sin costo extra.",
        nuevo:
          "Kora no es un channel manager y hoy no sincroniza calendarios con Booking, Airbnb ni Expedia: si vendes en varias OTAs, el channel manager lo contratas aparte.",
      },
      {
        viejo:
          "En Kora conectamos tus calendarios OTA vía iCal sin costo extra: ya viene dentro de tu suscripción.",
        nuevo:
          "Kora ataca el problema por el otro lado: en vez de sincronizar las OTAs, te da el motor de reservas directas, el agente de WhatsApp y el panel para que cada mes dependas menos de ellas.",
      },
      {
        viejo:
          "Kora sincroniza tus calendarios de Booking, Airbnb y demás OTAs vía iCal sin costo extra, junto con tu motor de reservas directas, agente de WhatsApp con IA y CRM por $550 MXN al mes.",
        nuevo:
          "Kora no sincroniza con las OTAs, pero por $550 MXN al mes te da el otro lado del problema: motor de reservas directas sin comisión, agente de WhatsApp con IA que cotiza y cobra, y el panel para operar tu hotel.",
      },
    ],
  },
  {
    slug: "como-evitar-overbooking-hotel-overbooking-en-hoteles-como-evitar-la-so",
    reemplazos: [
      {
        viejo:
          "En Kora la sincronización de calendarios viene incluida en el plan de $550 MXN mensuales, junto con motor de reservas directas, agente de WhatsApp con IA y CRM.",
        nuevo:
          "Kora no sincroniza calendarios con las OTAs: su calendario es el de tus reservas directas, las de WhatsApp y las que cargues a mano. Por $550 MXN al mes trae motor de reservas directas, agente de WhatsApp con IA y el panel para operar.",
      },
      {
        viejo:
          "Kora conecta tus OTAs en un solo calendario que descuenta el inventario en tiempo real, para que nunca vendas dos veces el mismo cuarto.",
        nuevo:
          "Kora descuenta el inventario en tiempo real en todo lo que entra por tu motor y por WhatsApp, así que ese cuarto no se vende dos veces. Lo que llega por las OTAs sigue tocándote a ti: Kora no se conecta con ellas.",
      },
    ],
  },
  {
    slug: "google-hotels-para-hoteles-google-hotels-para-hoteleros-como-vender-ha",
    reemplazos: [
      {
        viejo:
          "Kora conecta tu motor de reservas a Google, activa tu enlace directo y responde por WhatsApp con IA para que no se te enfríe ninguna reserva.",
        nuevo:
          "Kora te da el motor de reservas directas al que mandas ese tráfico y el agente de WhatsApp que contesta en segundos. El alta en Google —tu Perfil de Empresa y el enlace directo— la haces tú: Kora todavía no la hace por ti.",
      },
      {
        viejo:
          "Hacerlo a mano con Google Hotel Center es complicado, pero un motor de reservas moderno lo conecta por ti automáticamente: envía tus tarifas y disponibilidad a Google y coloca tu enlace directo.",
        nuevo:
          "Hacerlo a mano con Google Hotel Center es complicado, y no todos los motores lo resuelven: algunos mandan tus tarifas y disponibilidad a Google por ti, y otros —Kora entre ellos, hoy— no, así que ahí el alta corre por tu cuenta.",
      },
    ],
  },
];

console.log(
  `\n${ENVIAR ? "APLICANDO" : "ENSAYO (no escribe nada; agrega --enviar para aplicar)"}\n`,
);

let pendientes = 0;
let escritos = 0;

for (const art of CAMBIOS) {
  const { data, error } = await db
    .from("blog_articles")
    .select("slug, title, content")
    .eq("slug", art.slug)
    .maybeSingle();

  if (error) {
    console.log(`❌ ${art.slug}\n   no se pudo leer: ${error.message}\n`);
    continue;
  }
  if (!data) {
    console.log(`⚠️  ${art.slug}\n   no existe en blog_articles (¿se despublicó?)\n`);
    continue;
  }

  console.log(`── ${data.title}`);
  let contenido = data.content;
  let cambios = 0;

  for (const r of art.reemplazos) {
    if (contenido.includes(r.viejo)) {
      contenido = contenido.split(r.viejo).join(r.nuevo);
      cambios++;
      console.log(`   ✏️  «${r.viejo.slice(0, 70)}…»`);
      console.log(`       → «${r.nuevo.slice(0, 70)}…»`);
    } else if (contenido.includes(r.nuevo)) {
      console.log(`   ✅ ya corregido: «${r.nuevo.slice(0, 60)}…»`);
    } else {
      // Ni el viejo ni el nuevo: el texto cambió por otro lado. NO se inventa
      // nada — se avisa para revisarlo a mano.
      pendientes++;
      console.log(`   🔴 NO ENCONTRADO, revísalo a mano: «${r.viejo.slice(0, 70)}…»`);
    }
  }

  if (cambios === 0) {
    console.log("   (sin cambios que aplicar)\n");
    continue;
  }

  if (!ENVIAR) {
    console.log(`   → se aplicarían ${cambios} cambio(s)\n`);
    continue;
  }

  const { error: errEscribir } = await db
    .from("blog_articles")
    .update({ content: contenido, updated_at: new Date().toISOString() })
    .eq("slug", art.slug);

  if (errEscribir) {
    console.log(`   ❌ no se pudo guardar: ${errEscribir.message}\n`);
  } else {
    escritos += cambios;
    console.log(`   ✅ guardado (${cambios} cambio(s))\n`);
  }
}

console.log(
  ENVIAR
    ? `\nListo: ${escritos} cambio(s) escritos.${pendientes ? ` ${pendientes} sin encontrar: revísalos a mano.` : ""}\n` +
        "El sitio sirve el blog con revalidación cada hora, así que puede tardar hasta 60 min en verse.\n"
    : "\nEnsayo terminado. Para aplicarlo:\n" +
        "  node --env-file=.env.local scripts/corregir-blog.mjs --enviar\n",
);
