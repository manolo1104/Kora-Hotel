// Crea (una sola vez) los productos y precios de Kora en Stripe e imprime
// los price IDs para pegarlos en .env.local (y en Vercel para producción).
//
// Uso:  STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs
// (correrlo con la llave de prueba y, cuando la cuenta esté activada, con la live)

import Stripe from "stripe";

const KEY = process.env.STRIPE_SECRET_KEY;
if (!KEY) {
  console.error("Falta STRIPE_SECRET_KEY. Ejemplo:");
  console.error("  STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-setup.mjs");
  process.exit(1);
}

const stripe = new Stripe(KEY);
const modo = KEY.startsWith("sk_live") ? "LIVE" : "PRUEBA";

const PLANES = [
  { clave: "kora", nombre: "Kora (todo incluido, habitaciones ilimitadas)", mxn: 550, env: "STRIPE_PRICE_KORA" },
];

console.log(`\nCreando productos en Stripe (modo ${modo})…\n`);

const lineas = [];
for (const p of PLANES) {
  // Busca un producto existente con la misma clave para no duplicar.
  const existentes = await stripe.products.search({
    query: `metadata['kora_plan']:'${p.clave}' AND active:'true'`,
  });
  let producto = existentes.data[0];
  if (!producto) {
    producto = await stripe.products.create({
      name: p.nombre,
      metadata: { kora_plan: p.clave },
    });
  }

  // Busca un precio recurrente MXN vigente; si no hay, lo crea.
  const precios = await stripe.prices.list({ product: producto.id, active: true, limit: 10 });
  let precio = precios.data.find(
    (x) => x.currency === "mxn" && x.recurring?.interval === "month" && x.unit_amount === p.mxn * 100
  );
  if (!precio) {
    precio = await stripe.prices.create({
      product: producto.id,
      currency: "mxn",
      unit_amount: p.mxn * 100,
      recurring: { interval: "month" },
      metadata: { kora_plan: p.clave },
    });
  }

  console.log(`  ✓ ${p.nombre} — $${p.mxn.toLocaleString("es-MX")} MXN/mes`);
  lineas.push(`${p.env}=${precio.id}`);
}

console.log(`\nPega estas líneas en .env.local (modo ${modo}):\n`);
for (const l of lineas) console.log(`  ${l}`);
console.log("\nListo. Recuerda repetirlo con la llave LIVE para producción (van en Vercel).\n");
