export interface ChecklistItem {
  id: string;
  label: string;
  categoria: 'habitacion' | 'bano' | 'piscina' | 'exterior' | 'amenidades';
}

// Items base para todas las suites
const BASE_ITEMS: ChecklistItem[] = [
  { id: 'camas', label: 'Camas tendidas y ropa de cama limpia', categoria: 'habitacion' },
  { id: 'almohadas', label: 'Almohadas y fundas en buen estado', categoria: 'habitacion' },
  { id: 'piso', label: 'Piso barrido y trapeado', categoria: 'habitacion' },
  { id: 'polvo', label: 'Muebles sin polvo', categoria: 'habitacion' },
  { id: 'ac', label: 'Aire acondicionado funcionando', categoria: 'habitacion' },
  { id: 'cortinas', label: 'Cortinas limpias y en buen estado', categoria: 'habitacion' },
  { id: 'bano_limpio', label: 'Baño completo limpio y desinfectado', categoria: 'bano' },
  { id: 'toallas', label: 'Toallas limpias reemplazadas', categoria: 'bano' },
  { id: 'amenidades', label: 'Amenidades (shampoo, jabón, papel) surtidas', categoria: 'amenidades' },
  { id: 'basura', label: 'Basura vaciada y bolsa nueva', categoria: 'habitacion' },
  { id: 'terraza', label: 'Terraza/balcón barrido', categoria: 'exterior' },
  { id: 'wifi', label: 'WiFi funcionando', categoria: 'amenidades' },
];

const POOL_ITEMS: ChecklistItem[] = [
  { id: 'piscina_nivel', label: 'Nivel de agua de piscina/tina correcto', categoria: 'piscina' },
  { id: 'piscina_limpia', label: 'Piscina/tina limpia sin residuos', categoria: 'piscina' },
  { id: 'cloro', label: 'Nivel de cloro verificado', categoria: 'piscina' },
];

const JACUZZI_ITEMS: ChecklistItem[] = [
  { id: 'jacuzzi', label: 'Tina de hidromasaje limpia y funcionando', categoria: 'piscina' },
  { id: 'jets', label: 'Jets del jacuzzi sin obstrucciones', categoria: 'piscina' },
];

// Suites con piscina privada
const POOL_SUITES = new Set(['Suite Flor de Liz 1', 'Suite Flor de Liz 2', 'Jungla']);
// Suites con tina de hidromasaje
const JACUZZI_SUITES = new Set(['Suite LindaVista']);

export const ALL_SUITES = [
  'Suite Flor de Liz 1', 'Suite Flor de Liz 2', 'Suite LindaVista', 'Jungla', 'Suite Lajas',
  'Lirios 1', 'Lirios 2', 'Orquídeas 2', 'Orquídeas Doble', 'Orquídeas 3', 'Bromelias',
  'Helechos 1', 'Helechos 2',
];

export function getChecklistItems(suite: string): ChecklistItem[] {
  const items = [...BASE_ITEMS];
  if (POOL_SUITES.has(suite)) items.push(...POOL_ITEMS);
  if (JACUZZI_SUITES.has(suite)) items.push(...JACUZZI_ITEMS);
  return items;
}

// Tareas de mantenimiento preventivo iniciales
export interface MaintenanceTask {
  suite: string;
  tarea: string;
  frecuenciaDias: number;
  notas: string;
  responsable: string;
}

export const INITIAL_MAINTENANCE_TASKS: MaintenanceTask[] = [
  // Todas las suites — A/C
  ...ALL_SUITES.map(s => ({
    suite: s, tarea: 'Limpieza filtro A/C', frecuenciaDias: 30,
    notas: 'Limpiar filtros del aire acondicionado', responsable: '',
  })),
  // Piscinas privadas
  ...['Suite Flor de Liz 1', 'Suite Flor de Liz 2', 'Jungla'].map(s => ({
    suite: s, tarea: 'Mantenimiento piscina', frecuenciaDias: 7,
    notas: 'Limpiar, balancear pH y cloro', responsable: '',
  })),
  // Jacuzzi/tina
  { suite: 'Suite LindaVista', tarea: 'Mantenimiento tina hidromasaje', frecuenciaDias: 14,
    notas: 'Limpiar jets y filtros', responsable: '' },
  // Hotel general
  { suite: 'HOTEL', tarea: 'Fumigación preventiva', frecuenciaDias: 30,
    notas: 'Control de plagas en áreas comunes', responsable: '' },
  { suite: 'HOTEL', tarea: 'Revisión eléctrica general', frecuenciaDias: 90,
    notas: 'Revisar tableros e instalaciones', responsable: '' },
  { suite: 'HOTEL', tarea: 'Revisión router WiFi Starlink', frecuenciaDias: 90,
    notas: 'Reiniciar y verificar señal en todas las suites', responsable: '' },
  { suite: 'HOTEL', tarea: 'Revisión área de piscina común', frecuenciaDias: 7,
    notas: 'Limpieza y mantenimiento piscina común', responsable: '' },
];
