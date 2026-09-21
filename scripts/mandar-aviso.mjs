// Mandar un aviso por correo a los hoteleros, sin pelearse con la terminal.
//
// POR QUÉ EXISTE: la regla desde el 21 sep 2026 es que todo cambio que afecte a
// los usuarios se avisa por correo. El camino era un `curl` con
// `source .env.local`, y ese `source` REVIENTA en zsh porque alguna variable del
// archivo lleva un salto de línea dentro («parse error near \\n»). Node lee ese
// mismo archivo sin quejarse, así que el aviso se manda desde aquí.
//
//   Ensayo (NO manda nada, sólo cuenta):
//     node --env-file=.env.local scripts/mandar-aviso.mjs camila-mantenimiento
//   Prueba (una copia, sólo a ti):
//     node --env-file=.env.local scripts/mandar-aviso.mjs camila-mantenimiento --prueba=tu@correo.com
//   Envío de verdad:
//     node --env-file=.env.local scripts/mandar-aviso.mjs camila-mantenimiento --enviar
//
// Lo corre Manolo: `CRON_SECRET` está marcada como sensible en Vercel y
// `vercel env pull` la devuelve VACÍA, así que el agente no puede mandarlo.

const SITIO = process.env.NEXT_PUBLIC_SITE_URL || "https://kora-hotel.com";
const SECRETO = process.env.CRON_SECRET;

const [aviso, ...banderas] = process.argv.slice(2);
const enviar = banderas.includes("--enviar");
const prueba = (banderas.find((b) => b.startsWith("--prueba=")) || "").split("=")[1];

if (!aviso) {
  console.error(
    "Falta el aviso. Ejemplo:\n" +
      "  node --env-file=.env.local scripts/mandar-aviso.mjs camila-mantenimiento\n" +
      "(sin más banderas es un ENSAYO: no manda nada)",
  );
  process.exit(1);
}
if (!SECRETO) {
  console.error("No encontré CRON_SECRET. ¿Corriste el comando con --env-file=.env.local?");
  process.exit(1);
}

const url = new URL("/api/cron/anuncio", SITIO.replace(/\/$/, ""));
url.searchParams.set("aviso", aviso);
if (prueba) url.searchParams.set("prueba", prueba);
else if (enviar) url.searchParams.set("enviar", "1");

const modo = prueba ? `PRUEBA → sólo a ${prueba}` : enviar ? "ENVÍO DE VERDAD" : "ENSAYO (no manda nada)";
console.log(`\n${modo}\naviso: ${aviso}\n`);

try {
  const res = await fetch(url, { headers: { authorization: `Bearer ${SECRETO}` } });
  const txt = await res.text();
  let datos;
  try {
    datos = JSON.parse(txt);
  } catch {
    console.error(`El servidor contestó ${res.status} y no era JSON:\n${txt.slice(0, 400)}`);
    process.exit(1);
  }
  console.log(JSON.stringify(datos, null, 2));

  if (datos.error === "no-autorizado") {
    console.log("\n👉 La llave no coincide con la de producción. Cópiala de Vercel → Settings → Environment Variables.");
  } else if (!prueba && !enviar) {
    console.log(
      `\n👉 Siguiente paso: mándate una copia a ti\n` +
        `   node --env-file=.env.local scripts/mandar-aviso.mjs ${aviso} --prueba=tu@correo.com\n` +
        `   y cuando te convenza:\n` +
        `   node --env-file=.env.local scripts/mandar-aviso.mjs ${aviso} --enviar\n`,
    );
  }
} catch (e) {
  console.error("No se pudo contactar con el sitio:", e.message);
  process.exit(1);
}
