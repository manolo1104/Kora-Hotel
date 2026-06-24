// Punto de entrada del motor de reservas. Permite importar desde "@/lib/booking"
// (como en Paraíso) y obtener tanto la lógica pura (engine) como la lectura de
// cuartos por hotel (rooms). NOTA: ya NO existe un BOOKING_ROOMS global — los
// cuartos vienen del hotel vía hotelRooms(hotel).
export * from "./engine";
export * from "./rooms";
