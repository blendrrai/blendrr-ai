export const colors = {
  bg: '#FCBACD',
  bgSoft: '#FFFFFF',
  border: '#EFA8BA',
  borderStrong: '#DE8A9F',
  text: '#2A0F1E',
  textMuted: '#7A4762',
  textFaint: '#A87890',
  primary: '#0A0A0A',
  primaryOn: '#FFFFFF',
  accent: '#FFB6CD',
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const shadow = {
  card: {
    // Neutral, low-intensity shadow — strong enough to lift cards off the
    // page, weak enough not to bleed a darker pink halo into the gaps
    // between stacked cards.
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  button: {
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

export const type = {
  display: { fontSize: 40, fontWeight: '700' as const, letterSpacing: -1.2 },
  title: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.6 },
  heading: { fontSize: 20, fontWeight: '600' as const, letterSpacing: -0.3 },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '500' as const, letterSpacing: 0.2 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
} as const;

export type Zone = 'face' | 'lips' | 'hair';

export const zoneLabels: Record<Zone, string> = {
  face: 'Face',
  lips: 'Lips',
  hair: 'Hair',
};
