// Cotejar el apellido que teclea un huésped contra el nombre de su reserva.
//
// DÓNDE SE USA: la puerta del QR FIJO del mostrador. Ese QR no lleva la reserva
// en el enlace, así que el huésped se identifica con folio + apellido — el mismo
// listón que el portal del huésped ya usa con folio + correo.
//
// POR QUÉ NO ES UN `includes` A SECAS: con "el nombre contiene el texto",
// teclear "Ana" abriría la reserva de "Anacleto Ruiz", y "Ruiz" la de cualquiera
// que lo lleve. Comparando PALABRAS COMPLETAS, el huésped sigue pudiendo teclear
// sólo uno de sus dos apellidos, pero un fragmento no vale.

/** Sin acentos, sin mayúsculas y sin espacios de más. */
export function normalizarNombre(v: string): string {
  return v
    .normalize("NFD")
    // Diacríticos combinantes. Escrito con \u para que sobreviva a copiar y
    // pegar: el rango literal es invisible y se pierde en cualquier editor.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * ¿El apellido tecleado es una de las palabras del nombre de la reserva?
 *
 * Tolera acentos, mayúsculas y espacios de más, porque el huésped teclea con una
 * mano en el mostrador. No tolera fragmentos.
 */
export function apellidoCoincide(nombreReserva: string, apellido: string): boolean {
  const buscado = normalizarNombre(apellido);
  if (buscado.length < 2) return false;
  return normalizarNombre(nombreReserva).split(" ").filter(Boolean).includes(buscado);
}
