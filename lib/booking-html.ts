/**
 * Shared booking confirmation HTML template.
 * Used by both printBookingPDF (client, browser print) and buildEmailHtml (server, Resend).
 */

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export function getDay(d: string): string {
  if (!d) return '—';
  return String(parseInt(d.split('-')[2]));
}
export function getMonthYear(d: string): string {
  if (!d) return '—';
  const [y, m] = d.split('-');
  return `${MONTHS_ES[parseInt(m)-1]} ${y}`;
}
export function fmtDateFull(d: string): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${parseInt(day)} de ${MONTHS_SHORT[parseInt(m)-1].toLowerCase()} ${y}`;
}
export function calcCancelDate72h(checkin: string): string {
  const d = new Date(checkin + 'T00:00:00');
  d.setDate(d.getDate() - 3);
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${d.getDate()} de ${months[d.getMonth()]} ${d.getFullYear()} a las 11:59 PM`;
}

export interface TourItem {
  nombre: string;
  personas: number;
  precio: number; // precio por persona
}

export interface BookingHtmlParams {
  confirmacion: string;
  cliente: string;
  suites: string[];          // list of suite names
  checkin: string;
  checkout: string;
  noches: number;
  huespedes: number;
  total: number;
  anticipo?: number;
  restante?: number;
  cancelDateStr: string;
  fechaLimiteStr: string;
  notasClienteText?: string;
  suiteImgSrc?: string;   // main image URL (absolute)
  suiteImgSrc2?: string;  // secondary image URL
  suiteImgSrc3?: string;  // tertiary image URL
  forPrint?: boolean;     // true = add window.print() script
  tourItems?: TourItem[]; // tours incluidos (aparecen en PDF)
  compact?: boolean;      // elimina hero+imágenes → una sola página al imprimir
}

export function buildBookingHtml(p: BookingHtmlParams): string {
  const anticipo = p.anticipo || 0;
  const restante = p.restante ?? (p.total - anticipo);

  const TEMPLATE_CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #e8e4dc; font-family: 'Jost', sans-serif; font-weight: 300; color: #1e1e18; padding: 32px 16px; }
.wrap { max-width: 640px; margin: 0 auto; background: #faf7f2; box-shadow: 0 32px 80px rgba(0,0,0,0.18); }
.hero { position: relative; height: 380px; overflow: hidden; background: #0e1f10; }
.hero-img { position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 60%, rgba(45,90,40,.6) 0%, transparent 55%), radial-gradient(ellipse at 80% 30%, rgba(20,50,18,.8) 0%, transparent 50%), linear-gradient(160deg, #1a3d1c 0%, #0d2610 40%, #071808 100%); }
.hero-img::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 120px 200px at 5% 20%, rgba(40,80,35,.7) 0%, transparent 70%), radial-gradient(ellipse 150px 250px at 95% 70%, rgba(35,75,30,.7) 0%, transparent 70%); }
.hero-img::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, transparent 0%, transparent 40%, rgba(7,24,8,.4) 65%, rgba(7,24,8,.92) 100%); }
.leaf { position: absolute; border-radius: 50% 5% 50% 5%; opacity: .10; }
.hero-content { position: absolute; bottom: 0; left: 0; right: 0; padding: 0 40px 36px; z-index: 2; }
.hero-eyebrow { font-size: 9px; letter-spacing: 5px; text-transform: uppercase; color: #c9a96e; margin-bottom: 8px; }
.hero-title { font-family: 'Cormorant Garamond', serif; font-size: 44px; font-weight: 300; line-height: 1; color: #f5f0e8; margin-bottom: 4px; }
.hero-title em { font-style: italic; color: #c9a96e; display: block; }
.hero-loc { font-size: 10px; letter-spacing: 4px; text-transform: uppercase; color: #7a9e7c; margin-bottom: 22px; }
.hero-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(201,169,110,.2); border: 1px solid rgba(201,169,110,.5); color: #c9a96e; padding: 8px 20px; font-size: 9px; letter-spacing: 4px; text-transform: uppercase; }
.cn-strip { background: #111d12; padding: 0 40px; display: flex; align-items: stretch; min-height: 68px; }
.cn-left { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 16px 0; border-right: 1px solid rgba(255,255,255,.06); }
.cn-lbl { font-size: 8px; letter-spacing: 4px; text-transform: uppercase; color: #4a6a4c; margin-bottom: 4px; }
.cn-val { font-family: 'Cormorant Garamond', serif; font-size: 22px; font-weight: 400; color: #c9a96e; letter-spacing: 2px; }
.cn-right { padding: 16px 0 16px 28px; display: flex; flex-direction: column; justify-content: center; }
.cn-present-lbl { font-size: 8px; letter-spacing: 3px; text-transform: uppercase; color: #4a6a4c; margin-bottom: 3px; }
.cn-present-val { font-size: 11px; color: #8ab08c; line-height: 1.5; }
.suite-strip { display: grid; grid-template-columns: 1.6fr 1fr; height: 240px; gap: 2px; background: #111d12; }
.suite-main { position: relative; overflow: hidden; background: #1a3520; }
.suite-main img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.suite-main-bg { position: absolute; inset: 0; background: linear-gradient(135deg, #1e4020 0%, #0f2810 100%); }
.suite-main-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(10,20,10,.85) 0%, transparent 50%); }
.suite-main-label { position: absolute; bottom: 0; left: 0; right: 0; padding: 18px 22px; z-index: 2; }
.suite-main-name { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-style: italic; color: #f5f0e8; margin-bottom: 2px; }
.suite-main-feat { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: #7aaa7c; }
.suite-side { display: grid; grid-template-rows: 1fr 1fr; gap: 2px; }
.suite-thumb { position: relative; overflow: hidden; background: #1a2818; }
.suite-thumb img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.suite-thumb-overlay { position: absolute; inset: 0; background: rgba(0,0,0,.3); }
.suite-thumb-label { position: absolute; bottom: 0; left: 0; right: 0; padding: 10px 12px; background: linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 100%); }
.thumb-name { font-size: 11px; font-weight: 400; color: #e8e4d8; }
.thumb-sub { font-size: 9px; color: #7a9e7c; letter-spacing: 1px; }
.body { padding: 40px 40px 0; }
.greeting-block { margin-bottom: 36px; }
.gold-rule { width: 48px; height: 1px; background: #c9a96e; margin: 0 0 20px; }
.greeting-name { font-family: 'Cormorant Garamond', serif; font-size: 30px; font-weight: 300; color: #1e1e18; line-height: 1.1; margin-bottom: 8px; }
.greeting-name em { font-style: italic; color: #3d6e40; }
.greeting-copy { font-size: 13px; color: #6a6a58; line-height: 1.8; max-width: 420px; }
.dates-block { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; background: #111d12; margin-bottom: 28px; padding: 24px 28px; }
.date-col { text-align: center; }
.date-lbl { font-size: 8px; letter-spacing: 4px; text-transform: uppercase; color: #4a6a4c; margin-bottom: 6px; }
.date-num { font-family: 'Cormorant Garamond', serif; font-size: 38px; font-weight: 300; color: #f5f0e8; line-height: 1; }
.date-month { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: #7aaa7c; margin-top: 4px; }
.date-time { font-size: 10px; color: #4a6a4c; margin-top: 5px; }
.date-arrow { padding: 0 20px; text-align: center; }
.nights-badge { font-family: 'Cormorant Garamond', serif; font-size: 26px; color: #c9a96e; display: block; line-height: 1; }
.nights-lbl { font-size: 8px; letter-spacing: 3px; text-transform: uppercase; color: #4a6a4c; display: block; margin-top: 4px; }
.section-hd { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
.section-hd-line { flex: 1; height: 1px; background: #e0dbd0; }
.section-hd-title { font-size: 8px; letter-spacing: 4px; text-transform: uppercase; color: #9a9a82; white-space: nowrap; }
.suites-list { margin-bottom: 28px; }
.suite-row { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-bottom: 1px solid #eae5d8; }
.suite-row:last-child { border-bottom: none; }
.suite-dot { width: 7px; height: 7px; border-radius: 50%; background: #3d6e40; flex-shrink: 0; }
.suite-name { font-family: 'Cormorant Garamond', serif; font-size: 17px; color: #1e1e18; flex: 1; }
.payment { border: 1px solid #e0dbd0; margin-bottom: 28px; overflow: hidden; }
.payment-hd { background: #f2ede4; padding: 12px 22px; font-size: 8px; letter-spacing: 4px; text-transform: uppercase; color: #9a9a82; }
.payment-body { padding: 18px 22px; }
.prow { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: #6a6a58; margin-bottom: 10px; }
.prow:last-child { margin-bottom: 0; }
.prow.divider { border-top: 1px solid #e0dbd0; padding-top: 14px; margin-top: 4px; }
.prow.divider .plabel { font-size: 14px; color: #1e1e18; font-weight: 400; }
.prow.divider .pamount { font-family: 'Cormorant Garamond', serif; font-size: 24px; color: #1e1e18; }
.paid-tag { display: inline-flex; align-items: center; gap: 4px; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #3d6e40; background: #eef5ee; padding: 2px 8px; border-radius: 20px; }
.deduct { color: #3d6e40; }
.balance-note { background: #fff8ee; border-left: 3px solid #c9a96e; padding: 10px 14px; margin-top: 14px; font-size: 12px; color: #7a6a40; line-height: 1.6; }
.cancel-banner { display: flex; align-items: center; gap: 18px; padding: 20px 22px; border: 1px solid #c8dfc9; background: #f4faf4; margin-bottom: 28px; }
.cancel-icon { width: 36px; height: 36px; border-radius: 50%; background: #3d6e40; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; font-size: 16px; font-weight: 700; }
.cancel-title { font-size: 13px; font-weight: 500; color: #1e1e18; margin-bottom: 3px; }
.cancel-date-str { font-size: 12px; color: #5a7a5c; line-height: 1.5; }
.cancel-date-str strong { color: #1e1e18; }
.arrive-section { margin-bottom: 8px; }
.arrive-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
.arrive-card { border: 1px solid #e0dbd0; padding: 18px; }
.arrive-card-num { font-family: 'Cormorant Garamond', serif; font-size: 28px; color: #c9a96e; line-height: 1; margin-bottom: 7px; }
.arrive-card-title { font-size: 12px; font-weight: 500; color: #1e1e18; margin-bottom: 4px; }
.arrive-card-copy { font-size: 12px; color: #7a7a62; line-height: 1.6; }
.map-block { position: relative; height: 120px; background: linear-gradient(135deg, #d8e8d0 0%, #c8dcc0 100%); overflow: hidden; margin-bottom: 28px; }
.map-road-h { position: absolute; top: 50%; left: 0; right: 0; height: 6px; background: rgba(255,255,255,.5); transform: translateY(-50%); }
.map-road-v { position: absolute; left: 32%; top: 0; bottom: 0; width: 5px; background: rgba(255,255,255,.4); }
.map-pin-hotel { position: absolute; left: 32%; top: 50%; transform: translate(-50%, -50%); z-index: 2; }
.map-pin-dot-h { width: 14px; height: 14px; background: #1c2b1e; border-radius: 50%; border: 3px solid #c9a96e; }
.map-lbl-hotel { position: absolute; left: 20px; top: 50%; transform: translateY(-50%); background: #1c2b1e; color: #c9a96e; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; padding: 3px 8px; white-space: nowrap; }
.map-pin-pozas { position: absolute; left: 68%; top: 50%; transform: translate(-50%, -50%); z-index: 2; }
.map-pin-dot-g { width: 11px; height: 11px; background: #3d6e40; border-radius: 50%; border: 2px solid #fff; }
.map-lbl-pozas { position: absolute; right: 20px; top: 50%; transform: translateY(-50%); background: #3d6e40; color: #fff; font-size: 8px; letter-spacing: 1px; padding: 2px 7px; white-space: nowrap; }
.map-dist { position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%); font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: #2d5a30; background: rgba(255,255,255,.85); padding: 3px 10px; white-space: nowrap; }
.map-label { font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #2d5a30; background: rgba(255,255,255,.8); padding: 5px 16px; text-decoration: none; }
.upsell { margin: 0 -40px; background: #111d12; padding: 36px 40px; display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 28px; }
.upsell-eyebrow { font-size: 8px; letter-spacing: 4px; text-transform: uppercase; color: #4a6a4c; margin-bottom: 8px; }
.upsell-title { font-family: 'Cormorant Garamond', serif; font-size: 24px; font-weight: 300; font-style: italic; color: #f5f0e8; margin-bottom: 8px; line-height: 1.2; }
.upsell-copy { font-size: 11px; color: #6a8a6c; line-height: 1.9; }
.upsell-copy span { display: block; padding-left: 10px; position: relative; }
.upsell-copy span::before { content: '—'; position: absolute; left: 0; color: #c9a96e; }
.upsell-btn { display: block; border: 1px solid #c9a96e; color: #c9a96e; padding: 12px 20px; font-family: 'Jost', sans-serif; font-size: 9px; letter-spacing: 3px; text-transform: uppercase; text-decoration: none; text-align: center; white-space: nowrap; }
.contact-section { padding: 36px 40px 0; }
.contact-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1px; background: #e0dbd0; border: 1px solid #e0dbd0; margin-bottom: 36px; }
.contact-cell { background: #faf7f2; padding: 20px 14px; text-align: center; }
.contact-icon-wrap { width: 32px; height: 32px; border: 1px solid #e0dbd0; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 8px; color: #3d6e40; font-size: 14px; }
.contact-lbl { font-size: 8px; letter-spacing: 3px; text-transform: uppercase; color: #9a9a82; margin-bottom: 4px; }
.contact-val { font-size: 11px; color: #1e1e18; line-height: 1.5; }
.amenities { display: flex; justify-content: space-around; padding: 20px 0; border-top: 1px solid #eae5d8; border-bottom: 1px solid #eae5d8; margin-bottom: 36px; }
.amenity { text-align: center; }
.amenity-icon { margin-bottom: 5px; color: #3d6e40; font-size: 16px; }
.amenity-lbl { font-size: 8px; letter-spacing: 2px; text-transform: uppercase; color: #9a9a82; }
.amenity-val { font-size: 10px; color: #3d6e40; }
.social-block { background: #f2ede4; margin: 0 -40px; padding: 24px 40px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.social-lbl { font-size: 8px; letter-spacing: 3px; text-transform: uppercase; color: #9a9a82; margin-bottom: 3px; }
.social-handle { font-family: 'Cormorant Garamond', serif; font-size: 20px; font-style: italic; color: #1e1e18; }
.social-sub { font-size: 11px; color: #7a7a62; margin-top: 2px; }
.social-links { display: flex; gap: 8px; }
.social-link { display: flex; align-items: center; gap: 6px; border: 1px solid #d4cec7; padding: 8px 12px; font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #1e1e18; text-decoration: none; background: #faf7f2; }
.footer { background: #1c2b1e; padding: 40px; text-align: center; }
.footer-logo { font-family: 'Cormorant Garamond', serif; font-size: 26px; font-weight: 300; color: #f5f0e8; margin-bottom: 4px; }
.footer-logo em { font-style: italic; color: #c9a96e; }
.footer-tagline { font-size: 9px; letter-spacing: 4px; text-transform: uppercase; color: #4a6a4c; margin-bottom: 20px; }
.footer-divider { width: 1px; height: 36px; background: linear-gradient(to bottom, transparent, #4a6a4c, transparent); margin: 0 auto 20px; }
.footer-address { font-size: 11px; color: #4a6a4c; line-height: 2; }
.footer-address a { color: #7aaa7c; text-decoration: none; }
@media print { body { background: #fff; padding: 0; } .wrap { box-shadow: none; max-width: 100%; } .upsell { margin: 0; } .social-block { margin: 0; } @page { size: letter; margin: 0.5in; } }
`;

  const suites = p.suites;
  const tourItems = p.tourItems ?? [];
  const toursTotal = tourItems.reduce((s, t) => s + t.precio * t.personas, 0);

  // Compact-mode CSS — se añade sólo cuando compact:true
  const COMPACT_CSS = p.compact ? `
.compact-hdr { background: #1c2b1e; padding: 22px 40px; display:flex; align-items:center; justify-content:space-between; }
.compact-hdr-left p { font-size:9px; letter-spacing:4px; text-transform:uppercase; color:#4a6a4c; margin-bottom:4px; }
.compact-hdr-title { font-family:'Cormorant Garamond',serif; font-size:26px; font-weight:300; color:#f5f0e8; }
.compact-hdr-title em { font-style:italic; color:#c9a96e; }
.compact-hdr-right { text-align:right; }
.compact-hdr-cn-lbl { font-size:8px; letter-spacing:3px; text-transform:uppercase; color:#4a6a4c; margin-bottom:3px; }
.compact-hdr-cn-val { font-family:'Cormorant Garamond',serif; font-size:20px; color:#c9a96e; letter-spacing:2px; }
@media print { @page { size:letter; margin:0.45in; } }
` : '';

  const TOURS_CSS = tourItems.length > 0 ? `
.tours-list { margin-bottom:28px; }
.tour-row { display:flex; align-items:center; gap:14px; padding:10px 0; border-bottom:1px solid #eae5d8; }
.tour-row:last-child { border-bottom:none; }
.tour-dot { width:7px; height:7px; border-radius:50%; background:#c9a96e; flex-shrink:0; }
.tour-name { font-family:'Cormorant Garamond',serif; font-size:16px; color:#1e1e18; flex:1; }
.tour-detail { font-size:11px; color:#9a9a82; text-align:right; line-height:1.5; }
` : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Confirmación ${p.confirmacion} · Paraíso Encantado</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@200;300;400;500&display=swap" rel="stylesheet">
<style>${TEMPLATE_CSS}${COMPACT_CSS}${TOURS_CSS}</style>
</head>
<body>
<div class="wrap">

  ${p.compact ? `
  <div class="compact-hdr">
    <div class="compact-hdr-left">
      <p>Confirmación de reserva</p>
      <p class="compact-hdr-title">Paraíso <em>Encantado</em></p>
    </div>
    <div class="compact-hdr-right">
      <p class="compact-hdr-cn-lbl">Folio</p>
      <p class="compact-hdr-cn-val">${p.confirmacion}</p>
    </div>
  </div>
  ` : `
  <div class="hero">
    <div class="hero-img">
      <div class="leaf" style="width:160px;height:70px;background:#5a9e52;top:25px;left:-25px;transform:rotate(-25deg)"></div>
      <div class="leaf" style="width:130px;height:55px;background:#4a8e42;top:70px;right:-15px;transform:rotate(35deg);border-radius:5% 50% 5% 50%"></div>
      <div class="leaf" style="width:200px;height:85px;background:#6aae62;bottom:110px;left:35px;transform:rotate(15deg);opacity:.07"></div>
    </div>
    <div class="hero-content">
      <p class="hero-eyebrow">Reserva confirmada</p>
      <h1 class="hero-title">Paraíso<em>Encantado</em></h1>
      <p class="hero-loc">Xilitla · Huasteca Potosina · México</p>
      <div class="hero-badge">Tu escapada te espera</div>
    </div>
  </div>
  <div class="cn-strip">
    <div class="cn-left">
      <p class="cn-lbl">Número de confirmación</p>
      <p class="cn-val">${p.confirmacion}</p>
    </div>
    <div class="cn-right">
      <p class="cn-present-lbl">Al llegar presenta</p>
      <p class="cn-present-val">Este número en recepción<br>o muéstralo en tu celular</p>
    </div>
  </div>
  <div class="suite-strip">
    <div class="suite-main">
      ${p.suiteImgSrc ? `<img src="${p.suiteImgSrc}" alt="${suites[0]}" onerror="this.style.display='none'">` : '<div class="suite-main-bg"></div>'}
      <div class="suite-main-overlay"></div>
      <div class="suite-main-label">
        <p class="suite-main-name">${suites[0]}</p>
        <p class="suite-main-feat">${p.huespedes} huéspedes · ${p.noches} noche${p.noches !== 1 ? 's' : ''}</p>
      </div>
    </div>
    <div class="suite-side">
      <div class="suite-thumb">
        ${p.suiteImgSrc2 ? `<img src="${p.suiteImgSrc2}" alt="" onerror="this.style.display='none'">` : ''}
        <div class="suite-thumb-overlay"></div>
        <div class="suite-thumb-label">
          <p class="thumb-name">${suites.length > 1 ? suites[1] : 'Vista panorámica'}</p>
          <p class="thumb-sub">${suites.length > 1 ? 'Habitación 2' : 'Desde la terraza'}</p>
        </div>
      </div>
      <div class="suite-thumb">
        ${p.suiteImgSrc3 ? `<img src="${p.suiteImgSrc3}" alt="" onerror="this.style.display='none'">` : ''}
        <div class="suite-thumb-overlay"></div>
        <div class="suite-thumb-label">
          <p class="thumb-name">${suites.length > 2 ? suites[2] : 'Jardín & Piscina'}</p>
          <p class="thumb-sub">${suites.length > 2 ? 'Habitación 3' : 'Área común'}</p>
        </div>
      </div>
    </div>
  </div>
  `}

  <div class="body">

    <div class="greeting-block">
      <div class="gold-rule"></div>
      <h2 class="greeting-name">Bienvenido/a, <em>${p.cliente}.</em></h2>
      <p class="greeting-copy">Todo está listo. Tu reserva ha sido confirmada y el equipo de Paraíso Encantado ya prepara tu llegada. Pronto estarás despertando con el canto de las aves, rodeado de la selva surreal de Xilitla.</p>
    </div>

    <div class="dates-block">
      <div class="date-col">
        <p class="date-lbl">Check-in</p>
        <p class="date-num">${getDay(p.checkin)}</p>
        <p class="date-month">${getMonthYear(p.checkin)}</p>
        <p class="date-time">A partir de las 3:00 PM</p>
      </div>
      <div class="date-arrow">
        <span class="nights-badge">${p.noches}</span>
        <span class="nights-lbl">noche${p.noches !== 1 ? 's' : ''}</span>
      </div>
      <div class="date-col">
        <p class="date-lbl">Check-out</p>
        <p class="date-num">${getDay(p.checkout)}</p>
        <p class="date-month">${getMonthYear(p.checkout)}</p>
        <p class="date-time">Antes de las 12:00 PM</p>
      </div>
    </div>

    <div class="suites-list">
      <div class="section-hd">
        <p class="section-hd-title">Suites reservadas · ${p.huespedes} persona${p.huespedes !== 1 ? 's' : ''}</p>
        <div class="section-hd-line"></div>
      </div>
      ${suites.map(s => `<div class="suite-row"><div class="suite-dot"></div><p class="suite-name">${s}</p></div>`).join('')}
    </div>

    ${tourItems.length > 0 ? `
    <div class="tours-list">
      <div class="section-hd">
        <p class="section-hd-title">Tours incluidos · ${tourItems.length} servicio${tourItems.length !== 1 ? 's' : ''}</p>
        <div class="section-hd-line"></div>
      </div>
      ${tourItems.map(t => `
      <div class="tour-row">
        <div class="tour-dot"></div>
        <p class="tour-name">${t.nombre}</p>
        <div class="tour-detail">
          <span>${t.personas} persona${t.personas !== 1 ? 's' : ''}</span><br>
          <span>$${(t.precio * t.personas).toLocaleString('es-MX')} MXN</span>
        </div>
      </div>`).join('')}
    </div>` : ''}

    <div class="payment">
      <div class="payment-hd">Resumen de pago</div>
      <div class="payment-body">
        ${toursTotal > 0 ? `
        <div class="prow">
          <span class="plabel">Hospedaje (${suites.length} suite${suites.length !== 1 ? 's' : ''} · ${p.noches} noche${p.noches !== 1 ? 's' : ''})</span>
          <span class="pamount">$${(p.total - toursTotal).toLocaleString('es-MX')} MXN</span>
        </div>
        <div class="prow">
          <span class="plabel">Tours (${tourItems.length})</span>
          <span class="pamount">$${toursTotal.toLocaleString('es-MX')} MXN</span>
        </div>
        <div class="prow divider">
          <span class="plabel">Total</span>
          <span class="pamount">$${p.total.toLocaleString('es-MX')} MXN</span>
        </div>
        ` : `
        <div class="prow">
          <span class="plabel">Total estadía (${suites.length} suite${suites.length !== 1 ? 's' : ''} · ${p.noches} noche${p.noches !== 1 ? 's' : ''})</span>
          <span class="pamount">$${p.total.toLocaleString('es-MX')} MXN</span>
        </div>`}
        <div class="prow">
          <span class="plabel"><span class="paid-tag">Anticipo recibido</span></span>
          <span class="pamount deduct">− $${anticipo.toLocaleString('es-MX')} MXN</span>
        </div>
        <div class="prow divider">
          <span class="plabel">Saldo al check-in</span>
          <span class="pamount">$${restante.toLocaleString('es-MX')} MXN</span>
        </div>
        ${restante > 0
          ? `<div class="balance-note">Pagar $${restante.toLocaleString('es-MX')} MXN al llegar el ${fmtDateFull(p.checkin)}. Aceptamos efectivo y transferencia.<br>Fecha límite: <strong>${p.fechaLimiteStr}</strong>.</div>`
          : `<div class="balance-note" style="background:#eef5ee;border-left-color:#3d6e40;color:#2d5a30;">Pago completo. No hay saldo pendiente al check-in.</div>`}
      </div>
    </div>

    <div class="cancel-banner">
      <div class="cancel-icon">✓</div>
      <div>
        <p class="cancel-title">Cancelación gratuita disponible</p>
        <p class="cancel-date-str">Puedes cancelar sin costo hasta el <strong>${p.cancelDateStr}.</strong> Después aplica el cargo total.</p>
      </div>
    </div>

    <div class="arrive-section">
      <div class="section-hd">
        <p class="section-hd-title">Cómo llegar</p>
        <div class="section-hd-line"></div>
      </div>
      <div class="arrive-grid">
        <div class="arrive-card">
          <p class="arrive-card-num">01</p>
          <p class="arrive-card-title">Llega a Xilitla</p>
          <p class="arrive-card-copy">Por la carretera 120 hacia la Huasteca. Al entrar al pueblo sigue las señales a Las Pozas.</p>
        </div>
        <div class="arrive-card">
          <p class="arrive-card-num">02</p>
          <p class="arrive-card-title">Busca el hotel</p>
          <p class="arrive-card-copy">Estamos a 400m antes de la entrada al Jardín Surrealista, sobre la misma calle. A 5 min caminando.</p>
        </div>
      </div>
    </div>

    <a href="https://www.google.com/maps/search/Hotel+Paraíso+Encantado,+Xilitla,+San+Luis+Potosí" class="map-block" style="text-decoration:none;">
      <div class="map-road-h"></div>
      <div class="map-road-v"></div>
      <div class="map-pin-hotel">
        <div class="map-pin-dot-h"></div>
        <div class="map-lbl-hotel">Paraíso Encantado</div>
      </div>
      <div class="map-pin-pozas">
        <div class="map-pin-dot-g"></div>
        <div class="map-lbl-pozas">Jardín de Edward James</div>
      </div>
      <div class="map-dist">🚶 5 min caminando</div>
    </a>

    <div class="upsell">
      <div>
        <p class="upsell-eyebrow">Haz tu estadía memorable</p>
        <h3 class="upsell-title">¿Celebran algo especial?</h3>
        <div class="upsell-copy">
          <span>Desayuno privado en la terraza</span>
          <span>Decoración de suite con flores</span>
          <span>Fogata nocturna en el jardín</span>
        </div>
      </div>
      <a href="https://wa.me/524891007679" class="upsell-btn">Escribir<br>por WhatsApp</a>
    </div>

    ${p.notasClienteText ? `
    <div style="padding:20px 0;border-top:1px solid #eae5d8">
      <p style="font-size:8px;letter-spacing:3px;text-transform:uppercase;color:#9a9a82;margin-bottom:7px">Nota especial</p>
      <p style="font-family:'Cormorant Garamond',serif;font-size:15px;font-style:italic;color:#5a4e3c;line-height:1.7">${p.notasClienteText}</p>
    </div>` : ''}

  </div>

  <div class="contact-section">
    <div class="section-hd">
      <p class="section-hd-title">Contacto directo</p>
      <div class="section-hd-line"></div>
    </div>
    <div class="contact-grid">
      <div class="contact-cell">
        <div class="contact-icon-wrap">📞</div>
        <p class="contact-lbl">Teléfono</p>
        <p class="contact-val"><a href="tel:+524891007679" style="color:#1e1e18;text-decoration:none">489 100 7679</a></p>
      </div>
      <div class="contact-cell">
        <div class="contact-icon-wrap">💬</div>
        <p class="contact-lbl">WhatsApp</p>
        <p class="contact-val"><a href="https://wa.me/524891007679" style="color:#1e1e18;text-decoration:none">+52 489 100 7679</a></p>
      </div>
      <div class="contact-cell">
        <div class="contact-icon-wrap">✉️</div>
        <p class="contact-lbl">Email</p>
        <p class="contact-val"><a href="mailto:reservas@paraisoencantado.com" style="color:#1e1e18;text-decoration:none">reservas@<br>paraisoencantado.com</a></p>
      </div>
    </div>

    <div class="amenities">
      <div class="amenity"><div class="amenity-icon">🚗</div><p class="amenity-lbl">Estacionamiento</p><p class="amenity-val">Gratuito</p></div>
      <div class="amenity"><div class="amenity-icon">📶</div><p class="amenity-lbl">WiFi</p><p class="amenity-val">Alta velocidad</p></div>
      <div class="amenity"><div class="amenity-icon">🌿</div><p class="amenity-lbl">Las Pozas</p><p class="amenity-val">5 min caminando</p></div>
      <div class="amenity"><div class="amenity-icon">🔒</div><p class="amenity-lbl">Reserva</p><p class="amenity-val">Directa</p></div>
    </div>

    <div class="social-block">
      <div>
        <p class="social-lbl">Comparte tu escapada</p>
        <p class="social-handle">@_paraiso_encantado</p>
        <p class="social-sub">Etiquétanos en tus fotos</p>
      </div>
      <div class="social-links">
        <a href="https://www.instagram.com/_paraiso_encantado/" class="social-link">IG</a>
        <a href="https://www.facebook.com/cabanas.encantado/" class="social-link">FB</a>
        <a href="https://www.youtube.com/@hotelparaisoencantadoxilit8111" class="social-link">YT</a>
      </div>
    </div>
  </div>

  <div class="footer">
    <p class="footer-logo">Paraíso <em>Encantado</em></p>
    <p class="footer-tagline">La casa en la Huasteca</p>
    <div class="footer-divider"></div>
    <p class="footer-address">
      Xilitla, San Luis Potosí 79910 · México<br>
      A 5 minutos caminando del Jardín Surrealista de Edward James<br>
      <a href="https://paraisoencantado.com">paraisoencantado.com</a>
    </p>
  </div>

</div>${p.forPrint ? '\n<script>window.onload=function(){window.print()}<\/script>' : ''}
</body></html>`;
}
