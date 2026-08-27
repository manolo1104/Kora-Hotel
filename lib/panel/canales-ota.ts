// ¿El panel ofrece hoy los canales OTA (iCal con Booking / Expedia)?
//
// RETIRADO el 26 ago 2026, y es una decisión de negocio: Kora va a conectarse a
// un channel manager de verdad en vez de sostener un iCal a mano. Mientras
// tanto, seguir ofreciéndolo en el panel es prometer una sincronización que
// nadie va a mantener — y el iCal de salida además está mal, porque publica un
// feed por TIPO de habitación y no por CUARTO FÍSICO (paso 3.6, K-22): en un
// hotel con dos cabañas iguales, vender una cierra las dos en Booking.
//
// LO QUE ESTA CONSTANTE **NO** HACE, Y ES A PROPÓSITO:
//
// Apaga la PESTAÑA del panel —nadie configura canales nuevos— pero NO corta los
// feeds que ya estuvieran pegados en una extranet. Cortarlos provoca sobreventa
// en las dos direcciones a la vez:
//
//   · Si se apaga el feed de SALIDA, Booking deja de ver las noches vendidas en
//     Kora y las vuelve a poner a la venta.
//   · Si se apaga la sincronización de ENTRADA, las reservas que entran por
//     Booking dejan de bloquear el calendario de Kora.
//
// O sea: lo peligroso no es dejarlo encendido, es apagarlo a medias. Los feeds
// se retiran cuando se sepa que nadie tiene URLs pegadas (o cuando el channel
// manager las sustituya), y eso es una comprobación de negocio, no de código.
//
// Ponerla en `true` devuelve la pestaña tal cual estaba: no se borra ni un canal
// ni una configuración.
export const CANALES_OTA_DISPONIBLES = false;
