export const ROOM_SLUG_MAP: Record<string, string> = {
  'suite-flor-de-liz-1': 'Suite Flor de Liz 1',
  'suite-flor-de-liz-2': 'Suite Flor de Liz 2',
  'suite-lindavista':    'Suite LindaVista',
  'jungla':              'Jungla',
  'suite-lajas':         'Suite Lajas',
  'lirios-1':            'Lirios 1',
  'lirios-2':            'Lirios 2',
  'orquideas-2':         'Orquídeas 2',
  'orquideas-doble':     'Orquídeas Doble',
  'orquideas-3':         'Orquídeas 3',
  'bromelias':           'Bromelias',
  'helechos-1':          'Helechos 1',
  'helechos-2':          'Helechos 2',
};

export const ROOM_NAME_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(ROOM_SLUG_MAP).map(([slug, name]) => [name, slug])
);

export function roomNameToSlug(name: string): string {
  return ROOM_NAME_TO_SLUG[name] ?? name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function slugToRoomName(slug: string): string | null {
  return ROOM_SLUG_MAP[slug] ?? null;
}
