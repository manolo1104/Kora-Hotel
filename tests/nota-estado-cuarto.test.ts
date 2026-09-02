// La nota interna de un cuarto cuando se cambia su estado.
//
// LO QUE PROTEGE: una nota puede llevar dentro algo que sólo sabe quien lo
// escribió ("el aire no enfría"). Rellenar la nota al elegir un estado ahorra
// tecleo quince veces al día, pero borrar un apunte de la camarista por mover un
// desplegable es perder información de operación sin que nadie se entere.

import { describe, it, expect } from "vitest";
import {
  notaAlCambiarEstado,
  esNotaAutomatica,
  NOTA_POR_ESTADO,
  NOTA_SALIDA_REGISTRADA,
} from "@/lib/booking/nota-cuarto";

describe("notaAlCambiarEstado", () => {
  it("rellena la nota si está vacía", () => {
    expect(notaAlCambiarEstado("LIMPIEZA", "")).toBe(NOTA_POR_ESTADO.LIMPIEZA);
    expect(notaAlCambiarEstado("MANTENIMIENTO", "   ")).toBe(NOTA_POR_ESTADO.MANTENIMIENTO);
  });

  it("reemplaza la nota de OTRO estado: ya no aplica", () => {
    // El cuarto estaba en limpieza y pasa a mantenimiento: dejar "Pendiente de
    // limpieza" sería mentir sobre por qué está fuera de servicio.
    expect(notaAlCambiarEstado("MANTENIMIENTO", NOTA_POR_ESTADO.LIMPIEZA))
      .toBe(NOTA_POR_ESTADO.MANTENIMIENTO);
  });

  it("reemplaza también la que deja el check-out", () => {
    // La escribe app/api/admin/reservas/[id]/checkout/route.ts. Si el mapa no la
    // reconociera como automática, el cuarto se quedaría con ella para siempre.
    expect(notaAlCambiarEstado("DISPONIBLE", NOTA_SALIDA_REGISTRADA))
      .toBe(NOTA_POR_ESTADO.DISPONIBLE);
  });

  it("🔴 NO toca lo que escribió una persona", () => {
    const aMano = "El aire no enfría, avisar a Luis";
    for (const estado of ["DISPONIBLE", "OCUPADA", "LIMPIEZA", "MANTENIMIENTO"] as const) {
      expect(notaAlCambiarEstado(estado, aMano)).toBe(aMano);
    }
  });

  it("tampoco si el texto a mano SE PARECE a una automática", () => {
    // "Pendiente de limpieza urgente" no es "Pendiente de limpieza": la
    // comparación es exacta a propósito, no por inclusión.
    const casi = NOTA_POR_ESTADO.LIMPIEZA + " urgente";
    expect(notaAlCambiarEstado("DISPONIBLE", casi)).toBe(casi);
  });

  it("los espacios de más no convierten una automática en escrita a mano", () => {
    expect(notaAlCambiarEstado("DISPONIBLE", `  ${NOTA_POR_ESTADO.LIMPIEZA}  `))
      .toBe(NOTA_POR_ESTADO.DISPONIBLE);
  });
});

describe("esNotaAutomatica", () => {
  it("los 4 estados tienen su nota, y ninguna está vacía", () => {
    const notas = Object.values(NOTA_POR_ESTADO);
    expect(notas).toHaveLength(4);
    for (const n of notas) {
      expect(n.trim().length).toBeGreaterThan(3);
      expect(esNotaAutomatica(n)).toBe(true);
    }
  });

  it("las 4 son distintas entre sí (si no, el estado no se distinguiría)", () => {
    expect(new Set(Object.values(NOTA_POR_ESTADO)).size).toBe(4);
  });

  it("un texto cualquiera NO es automática", () => {
    expect(esNotaAutomatica("falta una toalla")).toBe(false);
  });
});
