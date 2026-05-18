export const colors = {
  bg: '#FFF5F8',
  bgSoft: '#FFE7EF',
  border: '#FFD9E5',
  borderStrong: '#FFB6CD',
  text: '#2A0F1E',
  textMuted: '#7A4762',
  textFaint: '#B58FA1',
  primary: '#FF4F8B',
  primaryOn: '#FFFFFF',
  accent: '#FFC6DB',
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
    shadowColor: '#FF4F8B',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  button: {
    shadowColor: '#FF4F8B',
    shadowOpacity: 0.3,
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
