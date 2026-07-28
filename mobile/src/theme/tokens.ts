// Toci Pastel Apricot design tokens — mirrors docs/design-system.md.
// Single source of truth for color, type, spacing, radius, and shadow values
// shared by every screen. Do not hard-code these values inside components.

export type AccentKey =
  | 'apricot'
  | 'mint'
  | 'blush'
  | 'butter'
  | 'sky'
  | 'coral'
  | 'cocoa'
  | 'graphite';

export type AppearanceMode = 'system' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';

export interface AccentTokens {
  label: string;
  accent: string;
  accentSoft: string;
  accentWash: string;
  accentInk: string;
  onAccent: string;
  accentBorder: string;
  accentFocus: string;
  gradient: readonly [string, string];
}

// Section 4 — Theme Token Architecture
export const ACCENT_THEMES: Record<AccentKey, AccentTokens> = {
  apricot: {
    label: 'Toci Apricot',
    accent: '#F58A4B',
    accentSoft: '#FFB178',
    accentWash: '#FFF0E5',
    accentInk: '#A94F1F',
    onAccent: '#202124',
    accentBorder: '#F3B58E',
    accentFocus: 'rgba(245, 138, 75, 0.24)',
    gradient: ['#F58A4B', '#FFB178'],
  },
  mint: {
    label: 'Toci Mint',
    accent: '#C8EEC4',
    accentSoft: '#DDF7DA',
    accentWash: '#F0FAEF',
    accentInk: '#416E45',
    onAccent: '#202124',
    accentBorder: '#A9DDA4',
    accentFocus: 'rgba(200, 238, 196, 0.34)',
    gradient: ['#B5E7B0', '#DDF7DA'],
  },
  blush: {
    label: 'Toci Blush',
    accent: '#F7B1BB',
    accentSoft: '#FFD2D9',
    accentWash: '#FFF0F3',
    accentInk: '#9B4D5A',
    onAccent: '#202124',
    accentBorder: '#E99AA8',
    accentFocus: 'rgba(247, 177, 187, 0.30)',
    gradient: ['#F7B1BB', '#FFD2D9'],
  },
  butter: {
    label: 'Toci Butter',
    accent: '#FFFEAE',
    accentSoft: '#FFF8C7',
    accentWash: '#FFFEEA',
    accentInk: '#746B16',
    onAccent: '#202124',
    accentBorder: '#E9E27F',
    accentFocus: 'rgba(255, 254, 174, 0.38)',
    gradient: ['#F4ED83', '#FFFEAE'],
  },
  sky: {
    label: 'Toci Sky',
    accent: '#C4E6FF',
    accentSoft: '#D8EFFF',
    accentWash: '#EFF8FF',
    accentInk: '#376A8F',
    onAccent: '#202124',
    accentBorder: '#9FD0F4',
    accentFocus: 'rgba(196, 230, 255, 0.34)',
    gradient: ['#A9D8F8', '#D8EFFF'],
  },
  coral: {
    label: 'Toci Coral',
    accent: '#FF6962',
    accentSoft: '#FF9B95',
    accentWash: '#FFF0EF',
    accentInk: '#A53732',
    onAccent: '#202124',
    accentBorder: '#EA5550',
    accentFocus: 'rgba(255, 105, 98, 0.26)',
    gradient: ['#FF6962', '#FF9B95'],
  },
  cocoa: {
    label: 'Toci Cocoa',
    accent: '#836853',
    accentSoft: '#B89D87',
    accentWash: '#F4EEE9',
    accentInk: '#5E4634',
    onAccent: '#FFFFFF',
    accentBorder: '#725845',
    accentFocus: 'rgba(131, 104, 83, 0.26)',
    gradient: ['#836853', '#B89D87'],
  },
  graphite: {
    label: 'Toci Graphite',
    accent: '#737373',
    accentSoft: '#A5A5A5',
    accentWash: '#F1F1F1',
    accentInk: '#505050',
    onAccent: '#FFFFFF',
    accentBorder: '#666666',
    accentFocus: 'rgba(115, 115, 115, 0.24)',
    gradient: ['#737373', '#A5A5A5'],
  },
};

export const ACCENT_ORDER: AccentKey[] = [
  'apricot',
  'mint',
  'blush',
  'butter',
  'sky',
  'coral',
  'cocoa',
  'graphite',
];

// Section 3 — Semantic colors are stable across every theme and appearance.
export const SEMANTIC = {
  sage: '#8DAA91',
  recoveryBlue: '#A9C5D8',
  warmAmber: '#DDB36C',
  mutedTerracotta: '#C97B63',
  plumGray: '#8E8496',
};

export const LIGHT_SURFACES = {
  background: '#FBF8F3',
  backgroundSecondary: '#F6F0E8',
  card: '#FFFFFF',
  sheet: '#FDFBF8',
  textPrimary: '#202124',
  textSecondary: '#5F6268',
  textTertiary: '#8C857D',
  textDisabled: '#B7AEA4',
  border: '#EAE2D8',
  divider: '#EFE8DF',
  input: '#FAF7F2',
};

export const DARK_SURFACES = {
  background: '#111214',
  backgroundSecondary: '#191A1D',
  card: '#212226',
  sheet: '#212226',
  textPrimary: '#F7F5F1',
  textSecondary: '#B8B5B0',
  textTertiary: '#8C857D',
  textDisabled: '#5F6268',
  border: '#303238',
  divider: '#303238',
  input: '#191A1D',
};

// Dark mode's Accent Dark override (section 3) — only specified for the
// default Apricot theme; other accents keep their light-mode accent value.
export const DARK_ACCENT_APRICOT = '#F49A62';

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const RADIUS = {
  small: 10,
  input: 14,
  button: 16,
  card: 20,
  hero: 24,
  sheet: 28,
  pill: 9999,
  circle: 9999,
};

export const FONT_FAMILY = {
  display: 'Manrope_700Bold',
  displayMedium: 'Manrope_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
};

export const TYPE = {
  displayLarge: { fontFamily: FONT_FAMILY.display, fontSize: 32, lineHeight: 35 },
  screenTitle: { fontFamily: FONT_FAMILY.display, fontSize: 26, lineHeight: 30 },
  heroMetric: { fontFamily: FONT_FAMILY.display, fontSize: 34, lineHeight: 34 },
  heroMetricSmall: { fontFamily: FONT_FAMILY.display, fontSize: 28, lineHeight: 28 },
  sectionTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 18, lineHeight: 23 },
  cardTitle: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 16, lineHeight: 21 },
  body: { fontFamily: FONT_FAMILY.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: FONT_FAMILY.bodySemiBold, fontSize: 15, lineHeight: 21 },
  button: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 15, lineHeight: 18 },
  caption: { fontFamily: FONT_FAMILY.bodyMedium, fontSize: 13, lineHeight: 18 },
  microLabel: { fontFamily: FONT_FAMILY.bodyBold, fontSize: 11, lineHeight: 13 },
} as const;

export function shadow(level: 'card' | 'elevated' | 'pressed', scheme: ColorScheme) {
  const color = scheme === 'dark' ? '#000000' : '#523B25';
  const specs = {
    card: { opacity: scheme === 'dark' ? 0.28 : 0.06, radius: 24, offset: 8, elevation: 3 },
    elevated: { opacity: scheme === 'dark' ? 0.36 : 0.1, radius: 36, offset: 14, elevation: 6 },
    pressed: { opacity: scheme === 'dark' ? 0.24 : 0.08, radius: 12, offset: 4, elevation: 2 },
  }[level];
  return {
    shadowColor: color,
    shadowOpacity: specs.opacity,
    shadowRadius: specs.radius,
    shadowOffset: { width: 0, height: specs.offset },
    elevation: specs.elevation,
  };
}
