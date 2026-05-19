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
    shadowColor: '#7A1234',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  button: {
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
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
