export interface Article {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  image: string;
  imageAlt: string;
  content: string; // HTML string
}

export const articles: Article[] = [
  {
    slug: "como-aumentar-reservas-directas",
    title:
      "Cómo aumentar tus reservas directas y dejar de pagar comisiones a Booking",
    excerpt:
      "El 18% que le pagas a Booking en cada reserva puede quedarse en tu hotel. Te explicamos cómo.",
    date: "20 de mayo, 2026",
    readTime: "5 min",
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&auto=format&q=80",
    imageAlt: "Recepción de hotel boutique",
    content: `
      <p>Si tienes un hotel boutique en México, probablemente ya sabes la cuenta: Booking.com se lleva entre el 15% y el 20% de cada reserva que entra por su plataforma. Airbnb, entre el 3% y el 15%. Expedia, hasta un 25%. Son comisiones que salen directamente de tu bolsillo, mes tras mes, año tras año.</p>

      <p>Lo paradójico es que la mayoría de los hoteleros sabe exactamente cuánto paga en comisiones, pero no tiene un plan concreto para reducirlas. Este artículo es ese plan.</p>

      <h2>Por qué terminamos tan dependientes de las OTAs</h2>

      <p>No es un error tuyo. Las OTAs (Online Travel Agencies) invirtieron millones en posicionamiento, en publicidad y en hacer que reservar un hotel sea tan fácil como pedir comida a domicilio. Cuando alguien busca "hotel en Xilitla" en Google, Booking aparece antes que tu sitio web. Eso no es accidente: es el resultado de años de inversión en SEO y en marketing de performance.</p>

      <p>El problema no es usar las OTAs. El problema es <strong>depender de ellas al 70%, 80% o 90% de tu ocupación</strong>. A ese nivel, la OTA ya no es un canal de distribución: es tu jefe.</p>

      <h2>El verdadero costo de una reserva por Booking</h2>

      <p>Pongamos números reales. Supón que tienes 12 habitaciones, una tarifa promedio de $1,200 MXN por noche y una ocupación del 65%:</p>

      <ul>
        <li>Noches vendidas al mes: 12 × 30 × 65% = <strong>234 noches</strong></li>
        <li>Ingresos totales: 234 × $1,200 = <strong>$280,800 MXN/mes</strong></li>
        <li>Si el 70% viene de Booking: $196,560 MXN pasan por la OTA</li>
        <li>Comisión al 18%: <strong>$35,381 MXN que no son tuyos</strong></li>
      </ul>

      <p>Al año, eso son más de <strong>$424,000 MXN</strong> en comisiones. Es el sueldo de dos personas. Es un cuarto de renovación completo. Es el colchón de emergencia que tu hotel no tiene.</p>

      <h2>Las 5 estrategias que realmente funcionan</h2>

      <h3>1. Tu propio motor de reservas, no solo un correo de contacto</h3>

      <p>El error más común: tener un sitio web bonito con un formulario de "contáctanos" en lugar de un botón de "reservar ahora". El formulario genera fricción. La fricción mata conversiones.</p>

      <p>Un motor de reservas real permite al huésped ver disponibilidad en tiempo real, elegir fechas, seleccionar habitación y pagar en menos de tres minutos. Sin llamadas, sin esperar confirmación, sin incertidumbre. Si tu sitio no tiene eso hoy, estás regalando reservas a Booking.</p>

      <h3>2. WhatsApp como canal de cierre, no de consultas</h3>

      <p>México es el segundo país de Latinoamérica con mayor penetración de WhatsApp. El 90% de los mensajes de WhatsApp se leen en los primeros tres minutos. Si un huésped potencial te escribe a las 11 de la noche preguntando si tienes cuarto disponible para el fin de semana, y nadie contesta hasta el día siguiente, esa reserva ya no es tuya: fue a Booking.</p>

      <p>La solución no es contratar a alguien que conteste de noche. La solución es automatizar las respuestas con un agente de IA que conozca tu disponibilidad, tus precios y tu hotel, y que pueda cerrar la reserva completa, incluyendo el pago, desde la conversación de WhatsApp.</p>

      <h3>3. La paridad de precios al revés: sé más barato en directo</h3>

      <p>Las OTAs te exigen paridad de precios: que tu tarifa en Booking sea igual a la que ofreces en tu web. Pero lo que no pueden controlarte es el valor agregado. Ofrece en directo lo que Booking no puede dar: desayuno incluido, upgrade de habitación al llegar, late check-out sin costo, o una botella de vino en la habitación. El precio es el mismo, pero el valor es mayor. Y eso los huéspedes lo notan.</p>

      <h3>4. Email y WhatsApp post-estancia: convierte huéspedes en clientes</h3>

      <p>Un huésped que ya se quedó contigo es, estadísticamente, cinco veces más fácil de convertir en reserva futura que uno nuevo. Si no tienes un sistema de CRM que capture su información y le mande un mensaje tres meses después diciendo "Hola, se acercan las vacaciones, ¿te gustaría volver?", estás dejando ir a tus mejores prospectos.</p>

      <p>El costo de una reserva directa de un huésped que regresa: cero pesos en comisiones. El costo de adquirir un huésped nuevo por OTA: 18% de su reserva, mínimo.</p>

      <h3>5. Programa de referidos entre huéspedes</h3>

      <p>Tu mejor canal de marketing ya existe: son tus huéspedes actuales. Un programa simple funciona así: "Si traes a un amigo que se quede con nosotros, ambos obtienen una noche gratis en su próxima visita." No necesitas tecnología compleja. Necesitas preguntarles y hacer el seguimiento. Un CRM básico te lo da.</p>

      <h2>El papel de la tecnología: automatización, no sustitución</h2>

      <p>Muchos hoteleros escuchan "automatización" y piensan que significa perder el toque personal. Es lo contrario. La automatización hace el trabajo repetitivo (contestar "¿tienen cuarto disponible?", confirmar reservas, mandar la dirección, cobrar el anticipo) para que tú y tu equipo puedan enfocarse en lo que sí requiere un humano: recibir al huésped, crear experiencias, resolver problemas.</p>

      <p>Un agente de WhatsApp con IA no reemplaza la calidez de tu hotel. La libera.</p>

      <h2>Qué resultados son realistas</h2>

      <p>Hotel Paraíso Encantado en Xilitla, San Luis Potosí, es el hotel piloto de Kora. Antes de implementar el sistema, el 75% de sus reservas llegaban por OTAs. A los tres meses de usar Kora:</p>

      <ul>
        <li>Las <strong>reservas directas aumentaron un 40%</strong></li>
        <li>El tiempo de respuesta en WhatsApp pasó de horas a <strong>segundos</strong></li>
        <li>Las comisiones a OTAs se redujeron en <strong>$8,400 MXN al mes</strong></li>
      </ul>

      <p>No es magia. Es el resultado de tener un motor de reservas, un agente de WhatsApp y un PMS funcionando juntos desde el mismo sistema.</p>

      <h2>Por dónde empezar hoy</h2>

      <p>Si tu hotel depende en más del 50% de las OTAs para su ocupación, hay tres cosas que puedes hacer esta semana:</p>

      <ol>
        <li><strong>Audita tus números.</strong> ¿Cuánto pagaste en comisiones el mes pasado? Si no lo sabes exactamente, ese es el primer problema.</li>
        <li><strong>Revisa tu sitio web.</strong> ¿Tiene un motor de reservas real o solo un formulario de contacto? ¿Carga en menos de 3 segundos en móvil?</li>
        <li><strong>Prueba responder en WhatsApp hoy.</strong> La próxima vez que alguien te escriba preguntando disponibilidad, cronometra cuánto tardas en responder. Ese tiempo es dinero que se va.</li>
      </ol>

      <p>Si quieres ir más rápido, <a href="/#contacto" class="text-kora-primary underline font-medium">escríbenos y te mostramos cómo funciona Kora en tu hotel específico</a>, con tus números reales, en 20 minutos.</p>
    `,
  },
  {
    slug: "revenue-management-hoteles-boutique-mexico",
    title: "Guía completa: Revenue management para hoteles boutique en México",
    excerpt:
      "Sube y baja tus precios según la demanda, puentes y eventos locales. Sin ser un experto.",
    date: "15 de mayo, 2026",
    readTime: "8 min",
    image:
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&auto=format&q=80",
    imageAlt: "Vista de alberca en hotel boutique",
    content: `
      <p>Revenue management es la práctica de vender la habitación correcta, al huésped correcto, al precio correcto, en el momento correcto. Los grandes hoteles tienen departamentos enteros dedicados a esto. Los hoteles boutique, por lo general, tienen una tarifa para temporada alta y otra para temporada baja. Y dejan mucho dinero sobre la mesa.</p>

      <p>Este artículo explica los fundamentos del revenue management pensado para hoteles de 5 a 40 habitaciones en México: sin terminología técnica innecesaria, sin software de $50,000 USD al año, con estrategias que puedes aplicar esta semana.</p>

      <h2>Las tres métricas que sí importan</h2>

      <p>Antes de hablar de estrategia, hay tres números que todo hotelero boutique debería conocer de memoria:</p>

      <ul>
        <li><strong>Ocupación:</strong> el porcentaje de habitaciones vendidas sobre el total disponible. Una ocupación del 65% en temporada baja es sana; del 40% en temporada alta es una señal de alerta.</li>
        <li><strong>ADR (Average Daily Rate):</strong> el precio promedio por habitación por noche, calculando solo las noches vendidas. Si vendes 10 habitaciones: 3 a $800, 4 a $1,200 y 3 a $1,500, tu ADR es $1,160.</li>
        <li><strong>RevPAR (Revenue Per Available Room):</strong> la métrica que combina las dos anteriores. RevPAR = ADR × Ocupación. Una habitación disponible que no se vende contribuye cero al RevPAR. Por eso no basta con tener tarifa alta si tu ocupación es baja.</li>
      </ul>

      <h2>Los 5 factores que deberían mover tu precio</h2>

      <h3>1. Ocupación en tiempo real</h3>
      <p>Si llevas el 80% de ocupación para el fin de semana y aún tienes 3 habitaciones disponibles, subir el precio no es especulación: es lo correcto. La escasez real justifica el precio mayor. Los huéspedes que buscan en el último momento están dispuestos a pagar más.</p>

      <h3>2. Puentes y días festivos mexicanos</h3>
      <p>El calendario de puentes en México es predecible. 16 de septiembre, Día de Muertos, 12 de diciembre, Semana Santa, Navidad y Año Nuevo. Si tu precio para esas fechas es igual que cualquier fin de semana regular, estás dejando ir ingresos que ya son tuyos por derecho.</p>

      <h3>3. Eventos locales y regionales</h3>
      <p>Un festival de música en tu ciudad. Una carrera de ciclismo. Un congreso nacional en el centro de convenciones más cercano. Estos eventos generan demanda concentrada que tú puedes anticipar. La clave es tener un sistema que monitoree esto, o al menos un calendario propio de eventos relevantes.</p>

      <h3>4. Anticipación de la reserva</h3>
      <p>Alguien que reserva con 3 meses de anticipación tiene más opciones y más tiempo. Alguien que reserva con 2 días de anticipación tiene menos. El precio debería reflejarlo: descuento por reserva anticipada y precio premium por reserva de último momento.</p>

      <h3>5. Duración de la estancia</h3>
      <p>Una estancia de 4 noches tiene menor costo operativo que 4 estancias de 1 noche. Puedes incentivar estancias largas con descuentos graduales: 5% en estancia de 3 noches, 10% en 5 noches o más. Llenas el hotel con menos operación.</p>

      <h2>Errores comunes que cuestan ocupación</h2>
      <p>El primero y más frecuente: <strong>subir el precio y bajar la visibilidad en las OTAs</strong>. Booking rankea los hoteles parcialmente por precio. Si subes mucho sin tener estrategia de tráfico directo, tu visibilidad cae y con ella tus reservas. El revenue management no funciona en aislado: necesita estar coordinado con tu estrategia de distribución.</p>

      <p>El segundo: <strong>bajar el precio en último momento para llenar habitaciones</strong>. Si llevas el 40% de ocupación para el fin de semana y bajas el precio el viernes en la mañana, entrenas a tus huéspedes a esperar el descuento de último momento. El precio bajo de emergencia debería ser la excepción, no el patrón.</p>

      <h2>Cómo automatizarlo sin ser un experto</h2>
      <p>La buena noticia es que los principios básicos del revenue management se pueden automatizar con la tecnología correcta. Un sistema que conozca tu ocupación en tiempo real, tenga acceso al calendario de puentes y eventos locales, y ajuste tus tarifas automáticamente dentro de los rangos que tú defines (mínimo y máximo), puede hacer el 80% del trabajo.</p>
      <p>El otro 20% es tu juicio: conoces tu mercado, tus huéspedes habituales y las particularidades de tu zona mejor que cualquier algoritmo.</p>
    `,
  },
  {
    slug: "agente-whatsapp-ia-hotel-2026",
    title:
      "Por qué tu hotel boutique necesita un agente de WhatsApp con IA en 2026",
    excerpt:
      "Las reservas que pierdes de noche porque nadie contesta son dinero que se va. Esto tiene solución.",
    date: "5 de mayo, 2026",
    readTime: "6 min",
    image:
      "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1200&auto=format&q=80",
    imageAlt: "Habitación de hotel boutique con vista",
    content: `
      <p>Son las 11:15 de la noche del miércoles. Alguien en la Ciudad de México acaba de confirmar que puede tomarse el fin de semana y decide buscar un hotel en la Huasteca Potosina. Encuentra tu hotel, le gusta lo que ve, y te manda un WhatsApp: "Hola, ¿tienen disponibilidad para este sábado y domingo?"</p>

      <p>Tú ya estás dormido. Tu recepcionista también. El mensaje queda en "enviado".</p>

      <p>El jueves en la mañana, cuando alguien lo ve, el huésped ya encontró otro lugar.</p>

      <h2>Cuántas reservas pierde un hotel típico por este motivo</h2>

      <p>No hay una estadística perfecta para hoteles boutique en México, pero la evidencia apunta en una dirección clara. Un estudio de Drift de 2021 encontró que el 82% de los consumidores espera una respuesta inmediata cuando contacta a una empresa por mensajería. "Inmediata" significa menos de 10 minutos.</p>

      <p>Para un hotel de 12 habitaciones que recibe 15 consultas por WhatsApp a la semana, perder el 30% por tiempo de respuesta lento equivale a 4 o 5 oportunidades perdidas cada semana. A una tasa de conversión del 40% y una tarifa promedio de $1,200 por noche, eso es entre $2,880 y $3,600 MXN de ingresos que no llegan cada semana. Al mes: más de $14,000 MXN.</p>

      <h2>Por qué no es suficiente con un mensaje automático</h2>

      <p>La respuesta fácil es activar el mensaje automático de WhatsApp Business: "Gracias por escribirnos, te respondemos en horario de oficina." Pero eso no cierra la reserva. Solo confirma que nadie está disponible.</p>

      <p>El problema no es la ausencia de respuesta: es la ausencia de respuesta útil. Un huésped que pregunta disponibilidad para el fin de semana no quiere saber que lo van a atender mañana. Quiere saber si hay cuarto, cuánto cuesta y cómo paga. Ahora.</p>

      <h2>Qué hace un agente de WhatsApp con IA que un mensaje automático no puede</h2>

      <p>Un agente de IA bien configurado puede:</p>
      <ul>
        <li>Consultar la disponibilidad real de tu hotel en tiempo real</li>
        <li>Informar precios según fecha y tipo de habitación</li>
        <li>Responder preguntas frecuentes: horarios de check-in, políticas de mascotas, cómo llegar, qué incluye el desayuno</li>
        <li>Enviar un link de pago directo dentro de la conversación</li>
        <li>Confirmar la reserva y enviar los datos de llegada automáticamente</li>
      </ul>

      <p>Todo esto en menos de 30 segundos, a las 2 de la mañana, en español correcto y con el tono de tu hotel.</p>

      <h2>El miedo más común: "¿Va a sonar robótico?"</h2>

      <p>Es una preocupación legítima. Un hotel boutique vive de la hospitalidad, del trato cercano, del detalle. Si el agente de IA suena como el menú de voz de un banco, daña la marca más de lo que ayuda.</p>

      <p>La diferencia está en cómo está configurado. Un agente que conoce el nombre de las habitaciones, la historia del hotel, el entorno natural de la zona, las actividades cercanas y las políticas específicas de tu propiedad suena completamente diferente a uno genérico. El huésped nota la diferencia entre "no tenemos disponibilidad para esas fechas" y "qué pena, esas fechas ya están completas, pero tenemos la Cabaña Huasteca disponible el fin de semana siguiente, ¿te interesa?"</p>

      <h2>Cuándo el agente debe escalar a un humano</h2>

      <p>Un buen agente de IA sabe cuándo no puede ayudar. Si el huésped tiene una solicitud especial (una propuesta de matrimonio, un grupo grande, una restricción alimentaria que no está en el menú estándar), el agente debe reconocerlo y transferir la conversación al equipo humano con un resumen de lo que ya se habló.</p>

      <p>La IA no reemplaza al equipo: filtra y maneja el volumen para que el equipo se enfoque en lo que requiere juicio humano.</p>

      <h2>El resultado en números reales</h2>

      <p>En Hotel Paraíso Encantado, el primer hotel en usar Kora, el tiempo de respuesta en WhatsApp pasó de un promedio de 4 horas a menos de 30 segundos. Las reservas directas aumentaron un 40% en los primeros tres meses. La mayoría del incremento no vino de más tráfico: vino de convertir consultas que antes se perdían.</p>

      <p>Si quieres ver cómo funciona en la práctica, <a href="/#contacto" class="text-kora-primary underline font-medium">escríbenos por WhatsApp y te mostramos el agente en acción</a> — la ironía es intencional.</p>
    `,
  },
];

export function getArticle(slug: string): Article | undefined {
  return articles.find((a) => a.slug === slug);
}
