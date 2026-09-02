'use client';

import { Pencil, X } from 'lucide-react';
import type { AdminBooking } from '@/lib/admin/sheets-admin';
import type { PreCheckinGuardado } from '@/lib/db/pre-checkin';
import { parseNotas } from '@/lib/notas';
import styles from './Modal.module.css';

// La reserva EN LECTURA. Es lo primero que se ve al abrir una reserva existente.
//
// POR QUÉ EXISTE: hasta ahora abrir una reserva era editarla — el formulario
// entero, editable, con el huésped delante. Un roce en una fecha y el PATCH
// revalida disponibilidad y le manda un correo de "tu reserva cambió" a alguien
// que no cambió nada.
//
// Es una FICHA y no el mismo formulario con los campos apagados: una pared de
// catorce campos grises se lee peor que diez líneas de etiqueta y valor. El
// patrón —y el detalle de no pintar las filas vacías— viene de `RegistroModal`.

/** Una fila. Devuelve `null` si no hay valor: media ficha en blanco no informa. */
function Dato({ etiqueta, valor, destacado = false }: {
  etiqueta: string; valor?: string | number | null; destacado?: boolean;
}) {
  const v = valor === 0 ? '0' : valor;
  if (v === null || v === undefined || String(v).trim() === '') return null;
  return (
    <div className={styles.fichaFila}>
      <span className={styles.fichaEtiqueta}>{etiqueta}</span>
      <span className={destacado ? styles.fichaValorFuerte : styles.fichaValor}>{String(v)}</span>
    </div>
  );
}

function dinero(n: number): string {
  return `$${Number(n || 0).toLocaleString('es-MX')} MXN`;
}

function fechaLarga(iso: string): string {
  if (!iso) return '';
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  });
}

interface Props {
  booking: AdminBooking;
  /** El registro que llenó el huésped, si lo hay. */
  registro: PreCheckinGuardado | null;
  /** ¿Ve importes? Lo decide el servidor (`reservas:dinero`). */
  verDinero: boolean;
  /** ¿Puede editar y cancelar? */
  puedeEditar: boolean;
  onEditar: () => void;
  onCancelarReserva: () => void;
  onClose: () => void;
}

export default function FichaReserva({
  booking, registro, verDinero, puedeEditar, onEditar, onCancelarReserva, onClose,
}: Props) {
  const notas = parseNotas(booking.notas || '');
  const saldo = booking.total - booking.anticipo;

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.title}>Reserva</h2>
        <span className={styles.confirmNum}>{booking.confirmacion}</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
      </div>

      <div className={styles.fichaCuerpo}>
        <section className={styles.seccion}>
          <h3 className={styles.seccionTitulo}>Huésped</h3>
          <Dato etiqueta="Nombre" valor={booking.cliente} />
          <Dato etiqueta="Teléfono" valor={booking.telefono} />
          <Dato etiqueta="Correo" valor={booking.email && booking.email !== 'N/A' ? booking.email : ''} />
        </section>

        <section className={styles.seccion}>
          <h3 className={styles.seccionTitulo}>Estancia</h3>
          <Dato etiqueta="Entrada" valor={fechaLarga(booking.checkin)} />
          <Dato etiqueta="Salida" valor={fechaLarga(booking.checkout)} />
          <Dato etiqueta="Noches" valor={booking.noches} />
          <Dato etiqueta="Habitación" valor={booking.habitaciones} />
          <Dato etiqueta="Huéspedes" valor={booking.huespedes} />
        </section>

        {verDinero && (
          <section className={styles.seccion}>
            <h3 className={styles.seccionTitulo}>Cobro</h3>
            <Dato etiqueta="Total" valor={dinero(booking.total)} destacado />
            <Dato etiqueta="Anticipo recibido" valor={dinero(booking.anticipo)} />
            <Dato etiqueta="Por pagar" valor={dinero(saldo)} destacado />
          </section>
        )}

        {/* El registro que llenó el huésped. Antes sólo vivía detrás del icono
            del QR, en otra ventana; aquí está donde recepción ya está mirando. */}
        {registro && (
          <section className={styles.seccion}>
            <h3 className={styles.seccionTitulo}>Registro del huésped</h3>
            <Dato etiqueta="Nombre que puso" valor={registro.nombreCompleto} />
            <Dato etiqueta="Domicilio" valor={registro.domicilio} />
            <Dato etiqueta="Procedencia" valor={[registro.ciudadOrigen, registro.pais].filter(Boolean).join(', ')} />
            <Dato
              etiqueta="Identificación"
              valor={[registro.documentoTipo, registro.documentoRef && `····${registro.documentoRef}`].filter(Boolean).join(' ')}
            />
            <Dato etiqueta="Llega a las" valor={registro.horaEstimada} />
            <Dato etiqueta="Placas" valor={registro.placas} />
            <Dato etiqueta="Acompañantes" valor={(registro.acompanantes ?? []).map(a => a.nombre).filter(Boolean).join(', ')} />
            <Dato etiqueta="Reglamento" valor={registro.aceptaReglamento ? 'Aceptado' : ''} />
            {registro.firma && (
              <div className={styles.fichaFirma}>
                <span className={styles.fichaEtiqueta}>Firma</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={registro.firma} alt="Firma del huésped" className={styles.fichaFirmaImg} />
              </div>
            )}
          </section>
        )}

        {(notas.cliente || notas.interno) && (
          <section className={styles.seccion}>
            <h3 className={styles.seccionTitulo}>Notas</h3>
            {notas.cliente && <p className={styles.fichaNota}>{notas.cliente}</p>}
            {notas.interno && (
              <p className={styles.fichaNota}>
                <span className={styles.fichaEtiqueta}>Interna · </span>{notas.interno}
              </p>
            )}
          </section>
        )}
      </div>

      <div className={styles.actions}>
        {puedeEditar && (
          <button type="button" className={styles.dangerBtn} onClick={onCancelarReserva}>
            Cancelar reserva
          </button>
        )}
        <button type="button" className={styles.secondaryBtn} onClick={onClose}>Cerrar</button>
        {puedeEditar && (
          <button type="button" className={styles.primaryBtn} onClick={onEditar}>
            <Pencil size={14} /> Editar
          </button>
        )}
      </div>
    </>
  );
}
