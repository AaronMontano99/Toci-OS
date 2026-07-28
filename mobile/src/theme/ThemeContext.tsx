import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import {
  ACCENT_THEMES,
  AccentKey,
  AppearanceMode,
  ColorScheme,
  DARK_ACCENT_APRICOT,
  DARK_SURFACES,
  LIGHT_SURFACES,
  SEMANTIC,
} from './tokens';

const STORAGE_KEY_ACCENT = 'toci:accentTheme';
const STORAGE_KEY_APPEARANCE = 'toci:appearance';

export interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  card: string;
  sheet: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textDisabled: string;
  border: string;
  divider: string;
  input: string;
  accent: string;
  accentSoft: string;
  accentWash: string;
  accentInk: string;
  onAccent: string;
  accentBorder: string;
  accentFocus: string;
  accentGradient: readonly [string, string];
  sage: string;
  recoveryBlue: string;
  warmAmber: string;
  mutedTerracotta: string;
  plumGray: string;
}

interface ThemeContextValue {
  appearance: AppearanceMode;
  accentTheme: AccentKey;
  colorScheme: ColorScheme;
  colors: ThemeColors;
  setAppearance: (mode: AppearanceMode) => void;
  setAccentTheme: (accent: AccentKey) => void;
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function buildColors(scheme: ColorScheme, accentTheme: AccentKey): ThemeColors {
  const surfaces = scheme === 'dark' ? DARK_SURFACES : LIGHT_SURFACES;
  const accentTokens = ACCENT_THEMES[accentTheme];
  const accent =
    scheme === 'dark' && accentTheme === 'apricot' ? DARK_ACCENT_APRICOT : accentTokens.accent;
  return {
    ...surfaces,
    accent,
    accentSoft: accentTokens.accentSoft,
    accentWash: accentTokens.accentWash,
    accentInk: accentTokens.accentInk,
    onAccent: accentTokens.onAccent,
    accentBorder: accentTokens.accentBorder,
    accentFocus: accentTokens.accentFocus,
    accentGradient: accentTokens.gradient,
    ...SEMANTIC,
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useSystemColorScheme();
  // Dark is the default demonstrated look for this app (per approved reference
  // mockups), overriding design-system.md's "light is primary" default --
  // still fully user-switchable in Profile -> Appearance.
  const [appearance, setAppearanceState] = useState<AppearanceMode>('dark');
  const [accentTheme, setAccentThemeState] = useState<AccentKey>('apricot');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [storedAppearance, storedAccent] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_APPEARANCE),
          AsyncStorage.getItem(STORAGE_KEY_ACCENT),
        ]);
        if (
          storedAppearance === 'system' ||
          storedAppearance === 'light' ||
          storedAppearance === 'dark'
        ) {
          setAppearanceState(storedAppearance);
        }
        if (storedAccent && storedAccent in ACCENT_THEMES) {
          setAccentThemeState(storedAccent as AccentKey);
        }
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setAppearance = (mode: AppearanceMode) => {
    setAppearanceState(mode);
    AsyncStorage.setItem(STORAGE_KEY_APPEARANCE, mode).catch(() => {});
  };

  const setAccentTheme = (accent: AccentKey) => {
    setAccentThemeState(accent);
    AsyncStorage.setItem(STORAGE_KEY_ACCENT, accent).catch(() => {});
  };

  const colorScheme: ColorScheme =
    appearance === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : appearance;

  const colors = useMemo(() => buildColors(colorScheme, accentTheme), [colorScheme, accentTheme]);

  const value = useMemo(
    () => ({ appearance, accentTheme, colorScheme, colors, setAppearance, setAccentTheme, ready }),
    [appearance, accentTheme, colorScheme, colors, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
