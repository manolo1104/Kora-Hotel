// Qué le dice Camila al huésped cuando el hotel se quedó sin saldo.
//
// La alternativa era el silencio, que es lo que hace el interruptor de apagado
// del hotelero. Aquí no sirve: el hotelero APAGA a Camila a propósito y sabe que
// va a contestar él; quedarse sin saldo le pasa sin querer, y el huésped que
// escribe a las once de la noche no tiene por qué pagar el despiste. Desde el
// otro lado, un WhatsApp de hotel que no contesta nada no parece un bot sin
// saldo: parece un hotel que no lee sus mensajes.
//
// El aviso NO llama al modelo —es texto fijo— así que no cuesta nada y no
// descuenta saldo. Por eso puede mandarse justamente cuando no hay saldo.
//
// Se manda UNA VEZ POR CHAT, no una vez por mensaje: si el huésped insiste, no
// se le repite la misma frase cinco veces.

/**
 * A propósito NO dice «se acabó el saldo» ni «el bot está desactivado».
 *
 * El huésped no es cliente de Kora y no tiene por qué enterarse de la
 * administración del hotel; contárselo sólo sirve para que el hotel quede mal.
 * Lo que necesita saber es que su mensaje llegó y que alguien lo va a atender.
 */
export function avisoSinSaldo() {
  return (
    "¡Hola! Recibimos tu mensaje 🙏\n\n" +
    "En un momento te atiende una persona del hotel. Si es urgente, no dudes en llamarnos."
  );
}
