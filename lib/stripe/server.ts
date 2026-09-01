import Stripe from "stripe";

// Cliente de Stripe: SOLO servidor (route handlers / server components).
// La llave vive en STRIPE_SECRET_KEY (sk_test_... en local, sk_live_... en Vercel).

const SECRET = process.env.STRIPE_SECRET_KEY ?? "";

/** true solo cuando la llave secreta de Stripe está configurada. */
export const stripeEnvReady = Boolean(SECRET);

let _stripe: Stripe | null = null;

// Versión de la API de Stripe, FIJADA a mano.
//
// Sin esto, la versión la elige el paquete `stripe` de npm: cada actualización
// la cambia sin decir nada, y una versión distinta puede alterar la forma de los
// eventos del webhook y el comportamiento de Checkout. Es el camino del dinero;
// que cambie en silencio al correr `npm update` es exactamente lo que no puede
// pasar.
//
// `Stripe.API_VERSION` es la versión que trae el paquete instalado. Al escribir
// el literal contra ese tipo, un salto de versión del paquete FALLA EN `tsc`
// —los dos literales dejan de coincidir— y obliga a leer el changelog y decidir
// a mano, que es lo que hay que hacer con el camino del dinero.
const API_VERSION: typeof Stripe.API_VERSION = "2026-05-27.dahlia";

// Aviso al arrancar en local con una llave de PRODUCCIÓN.
//
// La cabecera de este archivo dice "sk_test_... en local", pero eso es lo que
// debería ser, no lo que la máquina tenga puesto. Con una llave `sk_live` en
// `.env.local`, terminar un checkout desde `npm run dev` COBRA DE VERDAD a una
// tarjeta de verdad, y la reserva de prueba entra como reserva buena. Nada en la
// pantalla lo distingue.
//
// Se avisa por consola en vez de fallar: bloquear el arranque impediría trabajar
// a quien SÍ necesita apuntar a producción un momento (por ejemplo para leer
// datos). El aviso sale una vez, al crear el cliente.
if (process.env.NODE_ENV !== "production" && SECRET.startsWith("sk_live")) {
  console.warn(
    "\n⚠️  STRIPE EN MODO LIVE DESDE LOCAL: cualquier pago que completes aquí " +
      "COBRA DE VERDAD. Para probar, pon una llave sk_test_ en .env.local.\n",
  );
}

export function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(SECRET, { apiVersion: API_VERSION });
  return _stripe;
}
