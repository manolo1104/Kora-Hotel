'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  BedDouble, TrendingUp, CalendarCheck, DollarSign,
  MessageCircle, Mail, PenSquare, PhoneCall, Send, Sparkles,
  LogIn, LogOut, RefreshCw, ChevronRight, Trash2, Bot,
} from 'lucide-react';
import type { InsightsData, DayForecast, OriginBreakdown } from '@/lib/admin/insights';
import styles from './insights.module.css';

const fmt = (n: number) => `$${n.toLocaleString('es-MX')}`;
const pct = (n: number) => `${n}%`;

const CHAT_STORAGE_KEY = 'kora_insights_chat';
const MAX_STORED_MSGS = 20;

const SUGGESTED = [
  '¿Cuáles suites tienen check-in hoy?',
  '¿Cómo va mi ocupación este mes?',
  '¿Cuánto he ahorrado en comisiones OTA?',
  '¿Qué días de la semana tengo más llegadas?',
];

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

function loadChatHistory(): ChatMsg[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveChatHistory(msgs: ChatMsg[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(msgs.slice(-MAX_STORED_MSGS)));
  } catch { /* ignore */ }
}

export default function InsightsClient() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Load chat history from sessionStorage on mount
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      setChatMessages(loadChatHistory());
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/insights');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, streaming]);

  function clearChat() {
    setChatMessages([]);
    sessionStorage.removeItem(CHAT_STORAGE_KEY);
  }

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || streaming) return;
    setInput('');

    const next: ChatMsg[] = [...chatMessages, { role: 'user', content: msg }];
    setChatMessages(next);
    saveChatHistory(next);
    setStreaming(true);

    const placeholder: ChatMsg = { role: 'assistant', content: '' };
    setChatMessages([...next, placeholder]);

    try {
      const res = await fetch('/api/admin/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });

      if (!res.ok) {
        let serverMsg = 'Error al conectar con el asistente. Intenta de nuevo.';
        try {
          const data = await res.json();
          if (data?.error) serverMsg = data.error;
        } catch { /* respuesta sin JSON */ }
        throw new Error(serverMsg);
      }

      if (!res.body) throw new Error('Sin respuesta');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setChatMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: fullText };
          return updated;
        });
      }

      // Save final conversation to sessionStorage
      const finalMsgs: ChatMsg[] = [...next, { role: 'assistant', content: fullText }];
      saveChatHistory(finalMsgs);
      setChatMessages(finalMsgs);

    } catch (e) {
      const detail = e instanceof Error && e.message ? e.message : 'Error al conectar con el asistente. Intenta de nuevo.';
      const errorMsgs: ChatMsg[] = [...next, { role: 'assistant', content: detail }];
      setChatMessages(errorMsgs);
      saveChatHistory(errorMsgs);
    } finally {
      setStreaming(false);
    }
  }

  if (loading || !data) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.loadingSpinner} />
        <p>Cargando datos del hotel…</p>
      </div>
    );
  }

  const { hoy, mes, forecast7dias, origen, ahorroOTAs, agentes, totalSuites } = data;
  const checkins = hoy.movimientos.filter(m => m.tipo === 'checkin');
  const checkouts = hoy.movimientos.filter(m => m.tipo === 'checkout');

  const FOREST = '#2d4a3e';

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Insights</h1>
          <p className={styles.subtitle}>
            {new Date(hoy.fecha + 'T12:00:00').toLocaleDateString('es-MX', {
              weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
        <button className={styles.refreshBtn} onClick={load} title="Actualizar">
          <RefreshCw size={15} />
          Actualizar
        </button>
      </div>

      {/* ── CTA: configurar y entrenar a Camila (el bot) ──────────── */}
      <a
        href={`/panel/${slug}/camila`}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          background: FOREST, color: '#fff', borderRadius: 18,
          padding: '16px 20px', margin: '0 0 20px', textDecoration: 'none',
        }}
      >
        <span style={{
          display: 'grid', placeItems: 'center', width: 44, height: 44,
          borderRadius: 12, background: 'rgba(255,255,255,0.15)', flexShrink: 0,
        }}>
          <Bot size={22} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>
            Configura y entrena a Camila
          </span>
          <span style={{ display: 'block', fontSize: 13, opacity: 0.85 }}>
            Tu asistente de WhatsApp que contesta y reserva con los datos de tu hotel.
          </span>
        </span>
        <ChevronRight size={20} style={{ opacity: 0.9, flexShrink: 0 }} />
      </a>

      {/* ── KPI CARDS ─────────────────────────────────────────── */}
      <div className={styles.kpiGrid}>
        <KpiCard
          icon={<BedDouble size={20} />}
          label="Ocupación hoy"
          value={`${hoy.suitesOcupadas}/${totalSuites}`}
          sub={pct(hoy.porcentajeOcupacion)}
          accent={FOREST}
          bar={hoy.porcentajeOcupacion}
        />
        <KpiCard
          icon={<TrendingUp size={20} />}
          label="RevPAR del mes"
          value={fmt(mes.revpar)}
          sub={`ADR: ${fmt(mes.adr)}`}
          accent={FOREST}
        />
        <KpiCard
          icon={<CalendarCheck size={20} />}
          label="Reservas del mes"
          value={String(mes.reservas)}
          sub={`Ocupación ${pct(mes.ocupacion)}`}
          accent={FOREST}
        />
        <KpiCard
          icon={<DollarSign size={20} />}
          label="Ingresos del mes"
          value={fmt(mes.ingresos)}
          sub={`Ahorro OTAs año: ${fmt(ahorroOTAs)}`}
          accent={FOREST}
        />
      </div>

      {/* ── HOY EN EL HOTEL ───────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Hoy en el hotel</h2>
        {hoy.movimientos.length === 0 ? (
          <p className={styles.empty}>Sin movimientos programados para hoy.</p>
        ) : (
          <div className={styles.movGrid}>
            {checkins.length > 0 && (
              <div className={styles.movGroup}>
                <div className={styles.movGroupLabel}>
                  <LogIn size={13} color="#2d7a34" />
                  <span style={{ color: '#2d7a34' }}>Check-ins ({checkins.length})</span>
                </div>
                {checkins.map((m, i) => <MovRow key={i} mov={m} />)}
              </div>
            )}
            {checkouts.length > 0 && (
              <div className={styles.movGroup}>
                <div className={styles.movGroupLabel}>
                  <LogOut size={13} color="#c9484a" />
                  <span style={{ color: '#c9484a' }}>Check-outs ({checkouts.length})</span>
                </div>
                {checkouts.map((m, i) => <MovRow key={i} mov={m} />)}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── FORECAST + ORIGEN ─────────────────────────────────── */}
      <div className={styles.chartRow}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Ocupación próximos 7 días</h2>
          <ForecastBars data={forecast7dias} total={totalSuites} />
          <div className={styles.chartLegend}>
            <span><span className={styles.dot} style={{ background: '#2d7a34' }} /> +80%</span>
            <span><span className={styles.dot} style={{ background: '#52b788' }} /> 50-79%</span>
            <span><span className={styles.dot} style={{ background: 'var(--line)' }} /> &lt;50%</span>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Origen de reservas</h2>
          {origen.length === 0 ? (
            <p className={styles.empty}>Sin reservas este mes aún.</p>
          ) : (
            <>
              <OrigenDonut data={origen} />
              {/* Leyenda con números — siempre visible, sin depender del hover */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {(() => {
                  const total = origen.reduce((s, o) => s + o.count, 0);
                  return origen.map((o, i) => {
                    const p = total > 0 ? Math.round(o.count / total * 100) : 0;
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: o.color, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12, color: '#6b7280', fontFamily: 'var(--font-jost)' }}>{o.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-jost)' }}>{p}%</span>
                        <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'var(--font-jost)' }}>({o.count})</span>
                      </div>
                    );
                  });
                })()}
              </div>
              <div className={styles.otaSavings}>
                <span className={styles.otaLabel}>Ahorro OTAs (año)</span>
                <span className={styles.otaValue}>{fmt(ahorroOTAs)} MXN</span>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ── ACTIVIDAD AGENTES ─────────────────────────────────── */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Actividad de agentes</h2>
        <div className={styles.agentGrid}>
          <AgentCard
            icon={<MessageCircle size={18} color="#25D366" />}
            title="Bot WhatsApp"
            rows={[
              { label: 'Conversaciones hoy', value: String(agentes.whatsapp.conversacionesHoy) },
              { label: 'Conversaciones mes', value: String(agentes.whatsapp.conversacionesMes) },
            ]}
          />
          <AgentCard
            icon={<Mail size={18} color="#2d4a3e" />}
            title="Emails (mes)"
            rows={[
              { label: 'Confirmación', value: String(agentes.emails.confirmacion) },
              { label: 'Pre-estancia', value: String(agentes.emails.preestancia) },
              { label: 'Post-estancia', value: String(agentes.emails.postestancia) },
            ]}
          />
          <AgentCard
            icon={<PhoneCall size={18} color="#bbb" />}
            title="Agente Llamadas"
            rows={[{ label: 'Estado', value: 'Próximamente' }]}
            disabled
          />
          <AgentCard
            icon={<PenSquare size={18} color="#52b788" />}
            title="Blogs publicados"
            rows={[{ label: 'Este mes', value: String(agentes.blogs) }]}
          />
        </div>
      </section>

      {/* ── ASISTENTE IA ──────────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.chatHeader}>
          <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
            <Sparkles size={15} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle', color: '#52b788' }} />
            Asistente IA
          </h2>
          {chatMessages.length > 0 && (
            <button className={styles.chatClearBtn} onClick={clearChat} title="Borrar conversación">
              <Trash2 size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Limpiar
            </button>
          )}
        </div>

        <div className={styles.chatWrap}>
          {chatMessages.length === 0 && (
            <div className={styles.chatEmpty}>
              <p>Pregúntame sobre los datos de tu hotel en tiempo real.</p>
              <div className={styles.suggestedWrap}>
                {SUGGESTED.map((s, i) => (
                  <button key={i} className={styles.suggestedChip} onClick={() => sendMessage(s)}>
                    <ChevronRight size={11} />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {chatMessages.map((m, i) => (
            <div key={i} className={`${styles.chatMsg} ${m.role === 'user' ? styles.chatUser : styles.chatAssistant}`}>
              <div className={styles.chatBubble}>
                {m.content || (streaming && i === chatMessages.length - 1 ? '…' : '')}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <form
          className={styles.chatForm}
          onSubmit={e => { e.preventDefault(); sendMessage(); }}
        >
          <input
            className={styles.chatInput}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Pregunta sobre tus datos… (ej. ¿Cuál suite deja más ingresos?)"
            disabled={streaming}
          />
          <button className={styles.chatSend} type="submit" disabled={streaming || !input.trim()}>
            <Send size={15} />
          </button>
        </form>
      </section>
    </div>
  );
}

// ── Charts (SVG inline, reemplazan recharts) ──────────────────────────────────

// Barras de ocupación próximos 7 días. La altura usa el % (ya calculado con el
// total real del hotel en el server); `total` es solo para el tooltip "N/total".
function ForecastBars({ data, total }: { data: DayForecast[]; total: number }) {
  const W = 480, H = 200;
  const padT = 14, padB = 28, padX = 8;
  const plotH = H - padT - padB;
  const plotW = W - padX * 2;
  const n = data.length || 1;
  const slot = plotW / n;
  const barW = slot * 0.4;
  const colorFor = (p: number) => (p >= 80 ? '#2d7a34' : p >= 50 ? '#52b788' : 'var(--line)');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="Ocupación próximos 7 días">
      {data.map((d, i) => {
        const h = (d.porcentaje / 100) * plotH;
        const x = padX + slot * i + (slot - barW) / 2;
        const y = padT + plotH - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={Math.max(0, h)} rx={4} fill={colorFor(d.porcentaje)}>
              <title>{`${d.label}: ${d.ocupadas}/${total} suites (${d.porcentaje}%)`}</title>
            </rect>
            <text x={x + barW / 2} y={H - padB + 18} textAnchor="middle" fontSize="12" fill="#6b7280" fontFamily="var(--font-jost)">
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Donut de origen de reservas. Mismos colores (o.color) y datos (count).
function OrigenDonut({ data }: { data: OriginBreakdown[] }) {
  const size = 160, cx = size / 2, cy = size / 2;
  const rOuter = 72, rInner = 44;
  const total = data.reduce((s, o) => s + o.count, 0) || 1;
  const gap = 0.04; // separación angular entre segmentos (paddingAngle)

  let angle = -Math.PI / 2; // arranca arriba
  const arc = (cx0: number, cy0: number, r: number, a: number) => [cx0 + r * Math.cos(a), cy0 + r * Math.sin(a)];

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height={160} role="img" aria-label="Origen de reservas">
      {data.map((o, i) => {
        const frac = o.count / total;
        const sweep = frac * Math.PI * 2;
        const a0 = angle + gap / 2;
        const a1 = angle + sweep - gap / 2;
        angle += sweep;
        if (a1 <= a0) return null;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const [ox0, oy0] = arc(cx, cy, rOuter, a0);
        const [ox1, oy1] = arc(cx, cy, rOuter, a1);
        const [ix1, iy1] = arc(cx, cy, rInner, a1);
        const [ix0, iy0] = arc(cx, cy, rInner, a0);
        const d = [
          `M ${ox0} ${oy0}`,
          `A ${rOuter} ${rOuter} 0 ${large} 1 ${ox1} ${oy1}`,
          `L ${ix1} ${iy1}`,
          `A ${rInner} ${rInner} 0 ${large} 0 ${ix0} ${iy0}`,
          'Z',
        ].join(' ');
        const labelPct = Math.round(frac * 100);
        const [lx, ly] = arc(cx, cy, (rOuter + rInner) / 2, (a0 + a1) / 2);
        return (
          <g key={i}>
            <path d={d} fill={o.color}>
              <title>{`${o.label}: ${o.count} reservas · ${fmt(o.ingresos)}`}</title>
            </path>
            {frac > 0.04 && (
              <text x={lx} y={ly + 3} textAnchor="middle" fontSize="10" fontWeight={700} fill="#fff" fontFamily="var(--font-jost)">
                {labelPct}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, accent, bar,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  accent: string;
  bar?: number;
}) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiIcon} style={{ color: accent }}>{icon}</div>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
      <p className={styles.kpiSub}>{sub}</p>
      {bar !== undefined && (
        <div className={styles.kpiBar}>
          <div className={styles.kpiBarFill} style={{ width: `${bar}%`, background: accent }} />
        </div>
      )}
    </div>
  );
}

function MovRow({ mov }: { mov: { cliente: string; habitaciones: string; huespedes: number; noches: number; total: number } }) {
  return (
    <div className={styles.movRow}>
      <div className={styles.movMain}>
        <span className={styles.movCliente}>{mov.cliente}</span>
        <span className={styles.movSuite}>{mov.habitaciones}</span>
      </div>
      <div className={styles.movMeta}>
        <span>{mov.huespedes} huéspedes · {mov.noches} noches</span>
        <span className={styles.movTotal}>{fmt(mov.total)}</span>
      </div>
    </div>
  );
}

function AgentCard({
  icon, title, rows, disabled,
}: {
  icon: React.ReactNode;
  title: string;
  rows: { label: string; value: string }[];
  disabled?: boolean;
}) {
  return (
    <div className={`${styles.agentCard} ${disabled ? styles.agentDisabled : ''}`}>
      <div className={styles.agentHeader}>
        {icon}
        <span className={styles.agentTitle}>{title}</span>
      </div>
      {rows.map((r, i) => (
        <div key={i} className={styles.agentRow}>
          <span className={styles.agentLabel}>{r.label}</span>
          <span className={styles.agentValue}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
