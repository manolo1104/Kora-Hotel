// ¿El panel ofrece los canales enlazados por iCal (Airbnb, Booking.com,
// Expedia/Vrbo y cualquier otro calendario)?
//
// HISTORIA. Se retiró el 26 ago 2026 por dos defectos:
//   1. El feed de salida se publicaba por TIPO de habitación y no por CUARTO
//      FÍSICO (paso 3.6, K-22): con dos cabañas iguales, vender una cerraba
//      las dos en Booking (o, al revés, la segunda nunca se cerraba).
//   2. La sincronización corría una vez al día: hasta 24 h de sobreventa.
//
// REACTIVADO el 18 nov 2026, con los dos arreglados:
//   1. Un canal = una UNIDAD física. El feed (/api/h/<slug>/ical/<unidad>) y la
//      entrada (blocks.habitacion) hablan de la misma unidad.
//   2. Cron cada 15 min (vercel.json) + lectura al momento antes de apartar
//      una reserva si el calendario tiene más de 15 min (lib/canales/ical.ts).
//
// Lo que NO es: un channel manager. iCal sólo mueve fechas ocupadas (no
// tarifas ni datos del huésped) y cada OTA lee el feed de Kora a su ritmo
// (30 min – 3 h). La landing lo dice así, y `tests/integraciones-congruente`
// vigila que no prometa más.
//
// Ponerla en `false` vuelve a esconder la pestaña sin borrar ningún canal, y
// NO corta los feeds ya pegados en una extranet (cortarlos a medias provoca
// sobreventa en las dos direcciones).
export const CANALES_OTA_DISPONIBLES = true;
