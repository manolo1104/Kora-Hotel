'use client';

import { useState } from 'react';
import { UserPlus, Trash2, Loader2, Mail, Info, Copy, Check } from 'lucide-react';
import { ROLES, type MiembroHotel } from '@/lib/db/equipo';
import type { RolHotel } from '@/lib/tenant';
import { postJson, mensajeDeError } from '@/lib/ui/api';
import styles from './equipo.module.css';

// Pantalla de "quién trabaja aquí". Existe porque los cinco roles y su mapa de
// permisos llevaban meses en el código sin ninguna forma de dar de alta a nadie:
// un hotelero probando Kora escribió "no veo dónde crear un usuario para
// camarista".
//
// El texto está escrito para un dueño de hotel, no para un administrador de
// sistemas: nada de "invitar usuario", "asignar permisos" ni "provisionar".

/**
 * El mensaje que el dueño le manda por WhatsApp a su empleado.
 *
 * Es la pieza que faltaba: el problema real no era dar de alta a la camarista,
 * era EXPLICARLE cómo entrar. Va en segunda persona, con los pasos numerados y
 * sin una sola palabra de sistemas.
 */
function instrucciones(m: { email: string; rol: RolHotel }, hotel: string): string {
  const queHace = ROLES.find((r) => r.valor === m.rol)?.que ?? '';
  return [
    `Hola, ya te di de alta en el sistema del hotel ${hotel}.`,
    '',
    'Para entrar:',
    '1) Abre kora-hotel.com/entrar',
    '2) Elige la opción "Enlace al correo"',
    `3) Escribe tu correo: ${m.email}`,
    '4) Te llega un correo, ábrelo y listo — no necesitas contraseña.',
    '',
    `Lo que vas a poder hacer: ${queHace}`,
    '',
    'Guarda la página en tu celular para entrar rápido.',
  ].join('\n');
}

export default function EquipoClient({
  inicial,
  hotelNombre,
}: {
  inicial: MiembroHotel[];
  hotelNombre: string;
}) {
  const [equipo, setEquipo] = useState(inicial);
  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<RolHotel>('limpieza');
  const [guardando, setGuardando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [copiado, setCopiado] = useState<string | null>(null);
  const [aLaMano, setALaMano] = useState<MiembroHotel | null>(null);

  async function copiarInstrucciones(m: MiembroHotel) {
    const texto = instrucciones(m, hotelNombre);
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(m.userId);
      setTimeout(() => setCopiado((c) => (c === m.userId ? null : c)), 2500);
    } catch {
      // El portapapeles falla sin permiso (Safari, o http sin candado). En vez
      // de un `prompt()` —que bloquea toda la pestaña— el mensaje se enseña
      // aquí mismo para copiarlo a mano. Fallar en silencio dejaría al dueño
      // sin saber qué mandarle a su empleada, que es todo el punto del botón.
      setALaMano(m);
    }
  }

  async function refrescar() {
    const res = await fetch('/api/admin/equipo');
    if (res.ok) setEquipo(await res.json());
  }

  async function darDeAlta(e: React.FormEvent) {
    e.preventDefault();
    if (guardando || !email.trim()) return;
    setGuardando(true);
    setError('');
    setAviso('');
    try {
      const r = await postJson<{ email: string; creado: boolean }>('/api/admin/equipo', {
        email: email.trim(),
        rol,
      });
      setAviso(
        r.creado
          ? `Listo. ${r.email} ya puede entrar: dile que abra kora-hotel.com/entrar, elija "Enlace al correo" y escriba ese correo.`
          : `${r.email} ya tenía cuenta en Kora y ahora también entra a este hotel.`,
      );
      setEmail('');
      await refrescar();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  }

  async function cambiar(m: MiembroHotel, nuevo: RolHotel) {
    if (nuevo === m.rol || ocupado) return;
    setOcupado(m.userId);
    setError('');
    setAviso('');
    try {
      await postJson('/api/admin/equipo', { userId: m.userId, rol: nuevo }, 'PATCH');
      await refrescar();
    } catch (err) {
      setError(mensajeDeError(err));
      await refrescar(); // deshace el select si el servidor lo rechazó
    } finally {
      setOcupado(null);
    }
  }

  async function quitar(m: MiembroHotel) {
    if (ocupado) return;
    // Sacar a alguien del hotel se hace una vez y se nota: confirmar es barato.
    if (!confirm(`¿Quitar a ${m.email || 'esta persona'} del hotel? Dejará de tener acceso al panel.`)) return;
    setOcupado(m.userId);
    setError('');
    setAviso('');
    try {
      await postJson('/api/admin/equipo', { userId: m.userId }, 'DELETE');
      await refrescar();
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.pageTitle}>Quién trabaja aquí</h1>
        <p className={styles.pageSub}>
          Da de alta a tu recepcionista, tu camarista o tu encargada con su correo.
          Cada quien ve sólo lo suyo.
        </p>
      </div>

      {/* Alta */}
      <form className={styles.card} onSubmit={darDeAlta}>
        <h2 className={styles.cardTitle}>
          <UserPlus size={17} aria-hidden="true" /> Dar de alta a alguien
        </h2>

        <div className={styles.fila}>
          <div className={styles.campo}>
            <label className={styles.label} htmlFor="equipo-email">
              Su correo
            </label>
            <input
              id="equipo-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="camarista@ejemplo.com"
              className={styles.input}
              autoComplete="off"
            />
          </div>

          <div className={styles.campo}>
            <label className={styles.label} htmlFor="equipo-rol">
              Qué hace
            </label>
            <select
              id="equipo-rol"
              value={rol}
              onChange={(e) => setRol(e.target.value as RolHotel)}
              className={styles.input}
            >
              {ROLES.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className={styles.primaryBtn} disabled={guardando}>
            {guardando ? <Loader2 size={15} className={styles.spin} /> : <UserPlus size={15} />}
            {guardando ? 'Dando de alta…' : 'Dar de alta'}
          </button>
        </div>

        <p className={styles.ayudaRol}>
          {ROLES.find((r) => r.valor === rol)?.que}
        </p>

        <p className={styles.nota}>
          <Mail size={13} aria-hidden="true" />
          No necesitas inventarle una contraseña: entra desde{' '}
          <strong>kora-hotel.com/entrar</strong> con la opción{' '}
          <strong>&ldquo;Enlace al correo&rdquo;</strong>.
        </p>

        {error && <p className={styles.error}>{error}</p>}
        {aviso && <p className={styles.aviso}>{aviso}</p>}
      </form>

      {/* Lista */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Tu equipo ({equipo.length})</h2>

        {equipo.length === 0 ? (
          <p className={styles.empty}>Todavía no has dado de alta a nadie.</p>
        ) : (
          <div className={styles.tablaWrap}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>Correo</th>
                  <th>Qué hace</th>
                  <th aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {equipo.map((m) => (
                  <tr key={m.userId}>
                    <td>
                      <span className={styles.correo}>{m.email || '(sin correo)'}</span>
                      {m.nuncaEntro && (
                        <span className={styles.pendiente}>Todavía no ha entrado</span>
                      )}
                    </td>
                    <td>
                      <select
                        value={m.rol}
                        onChange={(e) => cambiar(m, e.target.value as RolHotel)}
                        disabled={ocupado === m.userId}
                        className={styles.selectRol}
                        aria-label={`Rol de ${m.email || 'este miembro'}`}
                      >
                        {ROLES.map((r) => (
                          <option key={r.valor} value={r.valor}>
                            {r.nombre}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={styles.acciones}>
                      <button
                        type="button"
                        className={styles.copiarBtn}
                        onClick={() => copiarInstrucciones(m)}
                        title="Copiar el mensaje de cómo entrar, listo para WhatsApp"
                      >
                        {copiado === m.userId ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiado === m.userId ? 'Copiado' : 'Cómo entrar'}</span>
                      </button>
                      <button
                        type="button"
                        className={styles.quitarBtn}
                        onClick={() => quitar(m)}
                        disabled={ocupado === m.userId}
                        title={`Quitar a ${m.email || 'esta persona'} del hotel`}
                      >
                        {ocupado === m.userId ? (
                          <Loader2 size={14} className={styles.spin} />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Respaldo si el navegador no dejó copiar: el texto, para tomarlo a mano. */}
      {aLaMano && (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            Cómo entra {aLaMano.email}
          </h2>
          <p className={styles.ayudaRol}>
            Tu navegador no dejó copiarlo solo. Selecciona el texto y mándaselo por
            WhatsApp:
          </p>
          <textarea
            className={styles.textoAMano}
            readOnly
            rows={12}
            value={instrucciones(aLaMano, hotelNombre)}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button type="button" className={styles.copiarBtn} onClick={() => setALaMano(null)}>
            Cerrar
          </button>
        </div>
      )}

      {/* Qué ve cada quien: evita la pregunta "¿y si le doy este rol qué pasa?" */}
      <div className={styles.card}>
        <h2 className={styles.cardTitle}>
          <Info size={16} aria-hidden="true" /> Qué ve cada quien
        </h2>
        <ul className={styles.listaRoles}>
          {ROLES.map((r) => (
            <li key={r.valor}>
              <strong>{r.nombre}:</strong> {r.que}
            </li>
          ))}
        </ul>
        <p className={styles.nota}>
          Cobros, la cuenta de banco que Camila le dicta a los huéspedes, el WhatsApp
          del hotel y esta misma pantalla son sólo del dueño — aunque le des el rol de
          encargada a alguien de confianza.
        </p>
      </div>
    </div>
  );
}
