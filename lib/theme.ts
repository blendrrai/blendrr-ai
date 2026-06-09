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

export type Zone =
  | 'lips'
  | 'foundation'
  | 'concealer'
  | 'blush'
  | 'bronzer'
  | 'eyeliner'
  | 'eyeshadow'
  | 'mascara'
  | 'eyebrows'
  | 'hair';

export const zoneLabels: Record<Zone, string> = {
  lips: 'Lips',
  foundation: 'Foundation',
  concealer: 'Concealer',
  blush: 'Blush',
  bronzer: 'Bronzer',
  eyeliner: 'Eyeliner',
  eyeshadow: 'Eyeshadow',
  mascara: 'Mascara',
  eyebrows: 'Eyebrows',
  hair: 'Hair colour',
};

export type ZoneCategory = 'lips' | 'face' | 'eyes' | 'hair';

export const ZONES_BY_CATEGORY: Record<ZoneCategory, Zone[]> = {
  lips: ['lips'],
  face: ['foundation', 'concealer', 'blush', 'bronzer'],
  eyes: ['eyeliner', 'eyeshadow', 'mascara', 'eyebrows'],
  hair: ['hair'],
};

export type Quality = 'medium' | 'ultra';

/**
 * Per-screen "shown" credit cost — what the user sees on the picker UI.
 * The actual total deducted is computed in the Edge Function:
 *   total = 1 + (multi ? 1 : 0) + (ultra ? 1 : 0)
 * So combinations are:
 *   single + medium = 1   single + ultra = 2
 *   multi  + medium = 2   multi  + ultra = 3
 * Picker labels show the per-option cost in isolation per user request:
 * "Don't tally these up". Users see 1/2 on each screen.
 */
export const qualityCost: Record<Quality, number> = {
  medium: 1,
  ultra: 2,
};

export type Mode = 'single' | 'multi';

export const modeCost: Record<Mode, number> = {
  single: 1,
  multi: 2,
};

export const MAX_PRODUCTS_MULTI = 5;

// Clothing try-on — separate from the makeup `Zone` since it maps to body
// regions, not facial features. Each value also tells the AI prompt which
// part of the user's body to edit and (critically) which parts to leave
// untouched.
export type ClothingZone = 'top' | 'bottom' | 'dress' | 'shoes' | 'jewelry' | 'accessory';

export const clothingZoneLabels: Record<ClothingZone, string> = {
  top: 'Top half',
  bottom: 'Bottom half',
  dress: 'Full outfit',
  shoes: 'Shoes',
  jewelry: 'Jewelry',
  accessory: 'Accessory',
};

export type Category = 'beauty' | 'clothing';
