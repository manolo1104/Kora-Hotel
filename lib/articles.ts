export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  publishedIso: string;
  updatedIso?: string;
  updatedDate?: string;
  readTime: string;
  category: string;
  tags: string[];
  image: string;
  imageAlt: string;
  content: string;
}

export const articles: Article[] = [
  // ─── Artículo 1 ──────────────────────────────────────────────────────────────
  {
    slug: "como-aumentar-reservas-directas",
    title:
      "Cómo aumentar reservas directas en tu hotel y dejar de pagar comisiones a Booking",
    excerpt:
      "El 18% que le pagas a Booking en cada reserva puede quedarse en tu hotel. Aquí están las 5 estrategias concretas que usan los hoteles boutique que sí lo logran.",
    author: "Manolo Covarrubias",
    date: "20 de mayo, 2026",
    publishedIso: "2026-05-20",
    readTime: "6 min",
    category: "Distribución hotelera",
    tags: ["reservas directas", "OTAs", "Booking", "channel management"],
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&auto=format&q=80",
    imageAlt: "Recepción de hotel boutique con huéspedes",
    content: `
<div class="callout-summary">
  <p class="callout-summary-title">Lo más importante</p>
  <ul>
    <li>Un hotel boutique de 12 habitaciones puede estar pagando más de $35,000 MXN al mes solo en comisiones a las OTAs.</li>
    <li>Las 5 estrategias de este artículo no requieren inversión publicitaria: solo sistemas y procesos correctos.</li>
    <li>Hotel Paraíso Encantado pasó del 75% al 53% de dependencia en OTAs en 3 meses.</li>
  </ul>
</div>

<p>Si tienes un hotel boutique en México, ya sabes la cuenta: Booking.com cobra entre el 15% y el 20% de cada reserva. Airbnb, entre el 3% y el 15%. Expedia, hasta un 25%. Son comisiones que salen directamente de tu bolsillo, mes tras mes.</p>

<p>Lo paradójico es que la mayoría de los hoteleros sabe exactamente cuánto paga en comisiones, pero no tiene un plan concreto para reducirlas. Este artículo es ese plan.</p>

<h2 id="cuanto-pagas">¿Cuánto estás pagando realmente?</h2>

<p>Hagamos el cálculo con números reales. Supón que tienes 12 habitaciones, una tarifa promedio de $1,500 MXN por noche y una ocupación del 65%:</p>

<div class="callout-stat">
  <span class="callout-stat-number">$35,100</span>
  <span class="callout-stat-label">MXN al mes que se van en comisiones si el 70% de tus reservas llegan por OTAs</span>
</div>

<p>Al año, eso son más de <strong>$421,000 MXN</strong> en comisiones. Es la nómina de dos personas. Es una renovación completa de habitaciones. Es el colchón de emergencia que tu hotel no tiene.</p>

<p>Y eso sin contar lo que pierdes en reservas que se caen porque nadie contestó el WhatsApp a tiempo, o en huéspedes que buscaron disponibilidad en tu web y no encontraron cómo reservar directo.</p>

<h2 id="por-que-dependemos">Por qué terminamos dependiendo de las OTAs</h2>

<p>No es un error tuyo. Las OTAs invirtieron millones en posicionamiento y en hacer que reservar sea tan simple como pedir comida a domicilio. Cuando alguien busca "hotel en Xilitla" en Google, Booking aparece antes que tu sitio. Eso no es accidente: es el resultado de años de inversión en SEO y en performance marketing.</p>

<p>El problema no es usar las OTAs. El problema es <strong>depender de ellas al 70%, 80% o 90% de tu ocupación</strong>. A ese nivel, la OTA ya no es un canal de distribución: es tu jefe.</p>

<div class="callout-tip">
  <p class="callout-tip-title">Punto de referencia saludable</p>
  <p>Los hoteles boutique con mejor rentabilidad generan entre el 40% y el 60% de sus reservas por canales directos. No significa eliminar las OTAs: significa no depender de ellas para sobrevivir.</p>
</div>

<h2 id="5-estrategias">Las 5 estrategias que realmente funcionan</h2>

<h3 id="motor-reservas">1. Motor de reservas propio, no un formulario de contacto</h3>

<p>El error más común: tener un sitio web bonito con un formulario de "contáctanos" en lugar de un botón de "reservar ahora". El formulario genera fricción. La fricción mata conversiones.</p>

<p>Un motor de reservas real permite al huésped ver disponibilidad en tiempo real, elegir fechas, seleccionar habitación y pagar en menos de tres minutos. Sin llamadas, sin esperar confirmación. Si tu sitio web no tiene eso hoy, cada visita que recibes es una oportunidad que potencialmente va a terminar en Booking.</p>

<h3 id="whatsapp-cierre">2. WhatsApp como canal de cierre, no de consultas</h3>

<p>México tiene una de las tasas de adopción de WhatsApp más altas del mundo. Si alguien te escribe a las 11 de la noche preguntando disponibilidad y nadie contesta hasta el día siguiente, esa reserva ya es de Booking.</p>

<p>La solución no es contratar a alguien que conteste de noche. La solución es un <a href="/caracteristicas#agente-whatsapp">agente de IA</a> que conozca tu disponibilidad y tus precios, y que pueda cerrar la reserva completa — incluyendo el pago — directamente desde la conversación de WhatsApp.</p>

<h3 id="paridad-precios">3. Paridad de precios a tu favor</h3>

<p>Las OTAs exigen paridad de precios: que tu tarifa en Booking sea igual a la de tu web. Lo que no controlan es el valor agregado. Ofrece en directo lo que Booking no puede dar:</p>

<ul>
  <li>Desayuno incluido</li>
  <li>Upgrade de habitación al llegar (según disponibilidad)</li>
  <li>Late check-out sin costo hasta las 2 PM</li>
  <li>Botella de vino o mezcal en la habitación</li>
</ul>

<p>El precio es el mismo. El valor percibido es mayor. Y eso los huéspedes lo notan.</p>

<h3 id="email-poststancia">4. Email y WhatsApp post-estancia: convierte huéspedes en clientes recurrentes</h3>

<p>Un huésped que ya se quedó contigo es cinco veces más fácil de convertir en reserva futura que uno nuevo. Si no tienes un CRM que capture su información y le mande un mensaje tres meses después diciendo "Hola, se acercan las vacaciones de verano, ¿te gustaría volver?", estás dejando ir a tus mejores prospectos.</p>

<p>El costo de una reserva directa de un huésped recurrente: cero pesos en comisiones. El costo de adquirir un huésped nuevo por OTA: entre 15% y 20% de la reserva.</p>

<h3 id="presencia-google">5. Presencia en Google Hoteles y Búsqueda Directa</h3>

<p>Cuando alguien busca tu hotel por nombre en Google, debe encontrar primero tu sitio web con un botón claro de "Reservar". Si lo que aparece primero es Booking.com, estás pagando comisiones por huéspedes que ya te buscaban a ti específicamente.</p>

<p>Google Hotels y el perfil de Google Business son gratuitos y tienen integración directa con tu motor de reservas. Sin comisión.</p>

<h2 id="rol-tecnologia">El rol de la tecnología: automatización, no sustitución</h2>

<p>Muchos hoteleros escuchan "automatización" y piensan que significa perder el toque personal de su hotel boutique. Es lo contrario.</p>

<div class="callout-quote">
  <p>La automatización hace el trabajo repetitivo para que tú y tu equipo puedan enfocarse en lo que sí requiere un humano: recibir al huésped, crear experiencias, resolver problemas.</p>
</div>

<p>Un agente de WhatsApp con IA no reemplaza la calidez de tu hotel. La libera. Responder "¿tienen disponibilidad para el fin de semana?" a las 2 AM no es hospitalidad — es administración. La hospitalidad empieza cuando el huésped cruza la puerta.</p>

<h2 id="resultados-reales">Resultados en un caso real</h2>

<p>Hotel Paraíso Encantado en Xilitla, San Luis Potosí, es el hotel piloto de <a href="/">Kora</a>. Antes de implementar el sistema, el 75% de sus reservas llegaban por OTAs. A los tres meses:</p>

<div class="callout-compare">
  <div class="callout-compare-before">
    <p class="callout-compare-label" style="color: #dc2626;">Antes de Kora</p>
    <ul>
      <li style="color: #7f1d1d;">75% reservas por OTAs</li>
      <li style="color: #7f1d1d;">Respuesta WA: 4+ horas</li>
      <li style="color: #7f1d1d;">Sin dashboard de métricas</li>
    </ul>
  </div>
  <div class="callout-compare-after">
    <p class="callout-compare-label" style="color: #1B4332;">Con Kora (mes 3)</p>
    <ul>
      <li style="color: #1B4332;">53% reservas por OTAs</li>
      <li style="color: #1B4332;">Respuesta WA: &lt; 30 segundos</li>
      <li style="color: #1B4332;">$8,400 MXN/mes ahorrados</li>
    </ul>
  </div>
</div>

<p>No es magia. Es el resultado de tener un motor de reservas, un agente de WhatsApp y un PMS funcionando juntos desde el mismo sistema. Puedes <a href="/casos/paraiso-encantado">leer el caso completo aquí</a>.</p>

<h2 id="por-donde-empezar">Por dónde empezar esta semana</h2>

<p>Si tu hotel depende en más del 50% de las OTAs, hay tres cosas que puedes hacer ahora:</p>

<ol>
  <li><strong>Audita tus números.</strong> ¿Cuánto pagaste en comisiones el mes pasado? Si no lo sabes exactamente, ese es el primer problema a resolver.</li>
  <li><strong>Revisa tu sitio web.</strong> ¿Tiene un motor de reservas real o solo un formulario de contacto? ¿Carga en menos de 3 segundos en móvil?</li>
  <li><strong>Mide el tiempo de respuesta en WhatsApp.</strong> Cronometra cuánto tardas en responder la próxima consulta. Ese tiempo, en minutos, es una métrica directa de cuántas reservas estás perdiendo.</li>
</ol>

<div class="callout-cta">
  <strong style="color: white; font-size: 1.1rem;">¿Quieres aplicarlo en tu hotel?</strong>
  <p>Te mostramos cómo quedaría configurado Kora en tu hotel específico, con tus números reales, en 20 minutos.</p>
  <a href="/#contacto">Solicitar demo gratuito →</a>
</div>
    `,
  },

  // ─── Artículo 2 ──────────────────────────────────────────────────────────────
  {
    slug: "revenue-management-hoteles-boutique-mexico",
    title:
      "Revenue management para hoteles boutique en México: guía práctica sin tecnicismos",
    excerpt:
      "Aprende a ajustar tus precios según demanda real, puentes y eventos locales. Sin ser un experto ni contratar a un revenue manager.",
    author: "Manolo Covarrubias",
    date: "15 de mayo, 2026",
    publishedIso: "2026-05-15",
    readTime: "8 min",
    category: "Revenue management",
    tags: ["revenue management", "RevPAR", "pricing dinámico", "tarifas hoteleras"],
    image:
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&auto=format&q=80",
    imageAlt: "Hotel boutique con alberca al atardecer",
    content: `
<div class="callout-summary">
  <p class="callout-summary-title">Lo más importante</p>
  <ul>
    <li>RevPAR = ADR × Ocupación. Esta es la métrica que importa, no solo la ocupación.</li>
    <li>Los 5 factores que deben mover tu precio: ocupación actual, puentes, eventos locales, anticipación de la reserva y duración de la estancia.</li>
    <li>El error más costoso: bajar el precio en último momento para llenar habitaciones.</li>
  </ul>
</div>

<p>Revenue management es la práctica de vender la habitación correcta, al huésped correcto, al precio correcto, en el momento correcto. Los grandes hoteles tienen departamentos enteros dedicados a esto. Los hoteles boutique, por lo general, tienen una tarifa para temporada alta y otra para temporada baja. Y dejan mucho dinero sobre la mesa.</p>

<p>Este artículo traduce los principios del revenue management al contexto real de un hotel de 5 a 40 habitaciones en México: sin terminología innecesaria, sin software de $50,000 USD al año.</p>

<h2 id="tres-metricas">Las tres métricas que sí importan</h2>

<p>Antes de hablar de estrategia, necesitas conocer tres números de memoria:</p>

<table class="article-table">
  <thead>
    <tr>
      <th>Métrica</th>
      <th>Qué mide</th>
      <th>Fórmula</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Ocupación</strong></td>
      <td>Habitaciones vendidas vs. disponibles</td>
      <td>Noches vendidas ÷ Noches disponibles × 100</td>
    </tr>
    <tr>
      <td><strong>ADR</strong></td>
      <td>Precio promedio por habitación vendida</td>
      <td>Ingresos totales ÷ Habitaciones vendidas</td>
    </tr>
    <tr>
      <td><strong>RevPAR</strong></td>
      <td>Ingreso por habitación disponible</td>
      <td>ADR × Ocupación (o Ingresos ÷ Habitaciones totales)</td>
    </tr>
  </tbody>
</table>

<div class="callout-tip">
  <p class="callout-tip-title">Por qué el RevPAR importa más que la ocupación</p>
  <p>Puedes tener 100% de ocupación vendiendo barato, o 70% de ocupación vendiendo bien. El hotel con 70% de ocupación y mayor ADR puede tener mejor RevPAR. La ocupación sola no te dice si estás ganando o dejando dinero.</p>
</div>

<h2 id="cinco-factores">Los 5 factores que deben mover tu precio</h2>

<h3 id="ocupacion-tiempo-real">1. Ocupación en tiempo real</h3>

<p>Si llevas el 80% de ocupación para el fin de semana y aún tienes 3 habitaciones disponibles, subir el precio no es especulación: es lo correcto. La escasez real justifica el precio mayor. Los huéspedes que reservan en el último momento están dispuestos a pagar más porque tienen menos opciones.</p>

<p>Regla práctica: cuando superes el 70% de ocupación para una fecha, sube la tarifa en un 15-20%.</p>

<h3 id="puentes-festivos">2. Puentes y días festivos mexicanos</h3>

<p>El calendario de puentes en México es completamente predecible. Si tu precio para el puente del 16 de septiembre es igual al de cualquier fin de semana regular, estás dejando ir ingresos que ya son tuyos.</p>

<div class="callout-note">
  <p><strong>Puentes de alto impacto en México:</strong> 16 de septiembre, Día de Muertos (1-2 nov), 12 de diciembre, Semana Santa, Navidad y Año Nuevo, Día del Trabajo (1 mayo), Día de la Independencia, Día de la Bandera. Márcalos en tu calendario con 6 meses de anticipación y ajusta tus tarifas.</p>
</div>

<h3 id="eventos-locales">3. Eventos locales y regionales</h3>

<p>Un festival de música en tu ciudad. Una carrera de ciclismo. Un congreso nacional en el centro de convenciones más cercano. Estos eventos generan demanda concentrada que puedes anticipar. Un hotel en Xilitla, por ejemplo, debe tener marcados el Festival de La Huasteca, el Día de Muertos de la región, y los fines de semana de temporada de cascadas.</p>

<h3 id="anticipacion">4. Anticipación de la reserva</h3>

<p>Alguien que reserva con 3 meses de anticipación tiene más opciones y más tiempo. Alguien que reserva con 48 horas tiene menos. El precio debería reflejarlo:</p>

<ul>
  <li><strong>Más de 60 días antes:</strong> descuento del 10% por reserva anticipada (genera cash flow temprano)</li>
  <li><strong>15-60 días antes:</strong> tarifa estándar</li>
  <li><strong>Menos de 7 días:</strong> tarifa premium por último momento</li>
</ul>

<h3 id="duracion-estancia">5. Duración de la estancia</h3>

<p>Una estancia de 4 noches tiene menor costo operativo que 4 estancias de 1 noche. Menos check-ins, menos housekeeping de rotación, menor desgaste. Puedes incentivar estancias largas:</p>

<ul>
  <li>3 noches: 5% de descuento</li>
  <li>5 noches o más: 10% de descuento + upgrade automático</li>
</ul>

<h2 id="errores-comunes">Los 3 errores más costosos</h2>

<h3>Error 1: Bajar el precio en último momento</h3>

<p>Si llevas el 40% de ocupación para el fin de semana y bajas el precio el viernes en la mañana, entrenas a tus huéspedes a esperar el descuento de último momento. En dos temporadas, tu tarifa publicada ya no les dice nada — saben que si esperan, el precio baja. Es muy difícil salir de este ciclo.</p>

<div class="callout-quote">
  <p>El precio bajo de emergencia debería ser la excepción absoluta, no el patrón. Una habitación vacía a $0 es mejor que entrenar a tus huéspedes a esperar descuentos.</p>
</div>

<h3>Error 2: Subir el precio sin estrategia de tráfico directo</h3>

<p>Booking rankea los hoteles parcialmente por precio. Si subes mucho sin tener <a href="/como-aumentar-reservas-directas">estrategia de reservas directas</a>, tu visibilidad en OTAs cae y con ella tus reservas. El revenue management no funciona en aislado.</p>

<h3>Error 3: No revisar los números regularmente</h3>

<p>El revenue management requiere datos recientes. Si no revisas tu ADR, ocupación y RevPAR al menos una vez por semana, estás tomando decisiones de precio a ciegas.</p>

<div class="callout-stat">
  <span class="callout-stat-number">+18%</span>
  <span class="callout-stat-label">de mejora en RevPAR promedio en hoteles boutique que implementan pricing dinámico básico en el primer trimestre</span>
</div>

<h2 id="como-automatizar">Cómo automatizarlo sin ser experto</h2>

<p>Los principios del revenue management se pueden automatizar con la tecnología correcta. Un <a href="/caracteristicas#pricing-dinamico">sistema de pricing dinámico</a> que conozca tu ocupación en tiempo real, tenga acceso al calendario de puentes y eventos, y ajuste tus tarifas dentro de los rangos que defines (mínimo y máximo) puede hacer el 80% del trabajo.</p>

<p>El otro 20% es tu juicio: conoces tu mercado, tus huéspedes habituales y las particularidades de tu zona mejor que cualquier algoritmo.</p>

<h2 id="primer-paso">El primer paso que puedes dar hoy</h2>

<p>Antes de pensar en herramientas, necesitas tener claros tus números base:</p>

<ol>
  <li>¿Cuál fue tu ocupación promedio el mes pasado?</li>
  <li>¿Cuál fue tu ADR promedio?</li>
  <li>¿Cuál es tu tarifa mínima (el precio por debajo del cual no vendes aunque la habitación esté vacía)?</li>
  <li>¿Cuáles son los 5 puentes del siguiente trimestre?</li>
</ol>

<p>Si tienes esas respuestas, ya tienes la base para empezar a hacer revenue management. Si no las tienes, el problema a resolver primero es tener visibilidad de tus propios números.</p>

<div class="callout-cta">
  <strong style="color: white; font-size: 1.1rem;">¿Quieres pricing dinámico en tu hotel?</strong>
  <p>Kora incluye pricing dinámico con IA que ajusta tus tarifas automáticamente. Te mostramos cómo funciona.</p>
  <a href="/#contacto">Ver demo del sistema →</a>
</div>
    `,
  },

  // ─── Artículo 3 ──────────────────────────────────────────────────────────────
  {
    slug: "agente-whatsapp-ia-hotel-2026",
    title:
      "Agente de WhatsApp con IA para hoteles: cómo dejar de perder reservas de noche",
    excerpt:
      "Cada mensaje de WhatsApp sin respuesta es una reserva que se va. En 2026, un agente de IA puede cerrar reservas completas mientras duermes. Así funciona.",
    author: "Manolo Covarrubias",
    date: "5 de mayo, 2026",
    publishedIso: "2026-05-05",
    readTime: "6 min",
    category: "Tecnología hotelera",
    tags: ["WhatsApp Business", "inteligencia artificial", "reservas", "automatización"],
    image:
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&auto=format&q=80",
    imageAlt: "Habitación de hotel boutique con vista a la naturaleza",
    content: `
<div class="callout-summary">
  <p class="callout-summary-title">Lo más importante</p>
  <ul>
    <li>Un hotel de 12 habitaciones puede perder más de $14,000 MXN al mes por mensajes de WhatsApp sin respuesta oportuna.</li>
    <li>Un mensaje automático de WhatsApp Business no cierra reservas — solo confirma que no hay nadie disponible.</li>
    <li>Un agente de IA bien configurado suena natural, conoce tu hotel y puede cerrar la reserva completa en 30 segundos.</li>
  </ul>
</div>

<p>Son las 11:15 de la noche del miércoles. Alguien en la Ciudad de México acaba de confirmar que puede tomarse el fin de semana y decide buscar un hotel en la Huasteca Potosina. Encuentra tu hotel, le gusta lo que ve, y te manda un WhatsApp: <em>"Hola, ¿tienen disponibilidad para este sábado y domingo?"</em></p>

<p>Tú estás dormido. Tu recepcionista también. El mensaje queda en "enviado".</p>

<p>El jueves en la mañana, cuando alguien lo ve, el huésped ya encontró otro lugar.</p>

<h2 id="costo-mensajes-perdidos">¿Cuánto dinero pierdes por esto cada mes?</h2>

<p>Hagamos los números para un hotel de 12 habitaciones:</p>

<div class="callout-stat">
  <span class="callout-stat-number">$14,400</span>
  <span class="callout-stat-label">MXN al mes que pierde un hotel típico por mensajes de WhatsApp sin respuesta oportuna</span>
</div>

<p>El cálculo: si recibes 20 consultas por WhatsApp a la semana, y el 30% no recibe respuesta antes de que el huésped encuentre otra opción, eso son 6 oportunidades perdidas. Con una tasa de conversión del 40% y una estancia promedio de 2 noches a $1,500 MXN, estás dejando ir $7,200 MXN por semana — $28,800 al mes en el mejor caso. Incluso siendo conservadores, es dinero real.</p>

<h2 id="por-que-no-basta-el-auto-reply">Por qué el mensaje automático no es suficiente</h2>

<p>La respuesta fácil es activar el mensaje automático de WhatsApp Business: <em>"Gracias por escribirnos, te respondemos en horario de oficina."</em></p>

<p>Pero eso no cierra la reserva. Solo confirma que no hay nadie disponible.</p>

<p>El problema no es la ausencia de respuesta: es la ausencia de <strong>respuesta útil</strong>. Un huésped que pregunta disponibilidad para el fin de semana no quiere saber que lo van a atender mañana. Quiere saber si hay cuarto, cuánto cuesta y cómo paga. Ahora.</p>

<div class="callout-compare">
  <div class="callout-compare-before">
    <p class="callout-compare-label" style="color: #dc2626;">Mensaje automático</p>
    <ul>
      <li style="color: #7f1d1d;">"Gracias, te respondemos pronto"</li>
      <li style="color: #7f1d1d;">No informa disponibilidad</li>
      <li style="color: #7f1d1d;">No da precio</li>
      <li style="color: #7f1d1d;">No cierra la reserva</li>
    </ul>
  </div>
  <div class="callout-compare-after">
    <p class="callout-compare-label" style="color: #1B4332;">Agente de IA</p>
    <ul>
      <li style="color: #1B4332;">Disponibilidad en tiempo real</li>
      <li style="color: #1B4332;">Precio por fechas exactas</li>
      <li style="color: #1B4332;">Link de pago dentro del chat</li>
      <li style="color: #1B4332;">Reserva confirmada en 30 seg</li>
    </ul>
  </div>
</div>

<h2 id="que-hace-el-agente">Qué puede hacer un agente de IA que un humano no puede (a las 2 AM)</h2>

<p>Un agente de IA bien configurado para tu hotel puede:</p>

<ul>
  <li>Consultar la disponibilidad real en tiempo real, sin acceder a sistemas internos de forma riesgosa</li>
  <li>Informar precios según fecha, tipo de habitación y número de noches</li>
  <li>Responder las 20 preguntas más frecuentes: horarios de check-in, políticas de mascotas, cómo llegar, qué incluye el desayuno, si hay estacionamiento</li>
  <li>Enviar un link de pago directo dentro de la conversación</li>
  <li>Confirmar la reserva y enviar automáticamente los datos de llegada al huésped</li>
  <li>Escalar al equipo humano cuando hay algo fuera de lo ordinario</li>
</ul>

<p>Todo esto en menos de 30 segundos, a la hora que sea, en español correcto y con el tono de tu hotel.</p>

<h2 id="miedo-robotico">El miedo más común: "¿Va a sonar robótico?"</h2>

<p>Es una preocupación legítima. Un hotel boutique vive de la hospitalidad, del trato cercano, del detalle. Si el agente de IA suena como el menú de voz de un banco, daña la marca más de lo que ayuda.</p>

<div class="callout-tip">
  <p class="callout-tip-title">La diferencia está en la configuración</p>
  <p>Un agente que conoce el nombre de las habitaciones, la historia del hotel, el entorno natural de la zona, las actividades cercanas y las políticas específicas de tu propiedad suena completamente diferente a uno genérico. La diferencia entre "no tenemos disponibilidad" y "qué pena, esas fechas ya están completas, pero tenemos la Cabaña Huasteca disponible el siguiente fin de semana, ¿te interesa?" es la diferencia entre perder y conservar al huésped.</p>
</div>

<h2 id="cuando-escalar-humano">Cuándo el agente pasa la conversación a un humano</h2>

<p>Un buen agente de IA sabe cuándo no puede ayudar. Si el huésped tiene una solicitud especial — una propuesta de matrimonio, un grupo de 40 personas, una restricción alimentaria fuera del menú estándar — el agente reconoce el límite y transfiere la conversación al equipo humano con un resumen de lo ya platicado.</p>

<p>La IA no reemplaza al equipo: filtra y maneja el volumen rutinario para que el equipo se enfoque en lo que requiere juicio humano.</p>

<h2 id="resultados-reales">Resultados en un hotel real</h2>

<p>En <a href="/casos/paraiso-encantado">Hotel Paraíso Encantado</a>, el primer hotel en usar Kora, el tiempo de respuesta en WhatsApp pasó de un promedio de 4 horas a menos de 30 segundos. Las reservas directas aumentaron un 40% en los primeros tres meses.</p>

<p>La mayor parte del incremento no vino de más tráfico al sitio web: vino de convertir consultas de WhatsApp que antes se perdían porque llegaban fuera del horario de atención.</p>

<div class="callout-quote">
  <p>Lo que más me sorprendió fue ver reservas llegando de noche por WhatsApp que antes simplemente no llegaban. No es que haya más tráfico: es que ahora podemos atenderlo.</p>
  <cite>Manolo Covarrubias, Hotel Paraíso Encantado, Xilitla SLP</cite>
</div>

<h2 id="como-empezar">Por dónde empezar</h2>

<p>Antes de pensar en tecnología, mide el problema en tu hotel específico:</p>

<ol>
  <li><strong>Revisa los últimos 30 días de WhatsApp.</strong> ¿Cuántos mensajes llegaron fuera del horario de atención? ¿Cuántos no tienen respuesta o se respondieron después de 3 horas?</li>
  <li><strong>Estima cuántas de esas conversaciones terminaron en reserva.</strong> Si menos del 30% lo hicieron, hay un problema claro de tiempo de respuesta.</li>
  <li><strong>Calcula el costo.</strong> Mensajes perdidos × tasa de conversión esperada × valor promedio de estancia.</li>
</ol>

<p>Si el número que resulta te incomoda, tienes tu justificación para actuar.</p>

<div class="callout-cta">
  <strong style="color: white; font-size: 1.1rem;">Mira el agente en acción</strong>
  <p>Escríbenos por WhatsApp y experimentas de primera mano cómo funciona el agente de Kora. La ironía es intencional.</p>
  <a href="/#contacto">Ver demo del agente de WhatsApp →</a>
</div>
    `,
  },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

export function getArticle(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}

export function extractHeadings(
  html: string
): { id: string; text: string }[] {
  const regex = /<h2[^>]*id="([^"]*)"[^>]*>(.*?)<\/h2>/g;
  const headings: { id: string; text: string }[] = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, "");
    headings.push({ id: match[1], text });
  }
  return headings;
}

export function calculateReadTime(html: string): string {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const wordCount = text.split(" ").filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return `${minutes} min`;
}
