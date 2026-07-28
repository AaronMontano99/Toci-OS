import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING, shadow } from '@/theme/tokens';

interface GradientHeroCardProps {
  watermarkIcon?: keyof typeof Ionicons.glyphMap;
  badgeIcon?: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}

// The dark, warm-tinted hero card used for Today's workout card and Program's
// header -- a photo-background look approximated with a gradient + a large
// faded glyph watermark rather than a stock photo, so nothing here is a
// fabricated image standing in for a real one.
export function GradientHeroCard({ watermarkIcon, badgeIcon, children }: GradientHeroCardProps) {
  const { colors, colorScheme } = useTheme();

  return (
    <LinearGradient
      colors={
        colorScheme === 'dark'
          ? ['#2A1D12', '#1A140E', '#0F0D0B']
          : [colors.accentWash, colors.card]
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        {
          borderRadius: RADIUS.hero,
          padding: SPACING.xl,
          gap: SPACING.md,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.border,
        },
        shadow('elevated', colorScheme),
      ]}
    >
      {watermarkIcon && (
        <Ionicons
          name={watermarkIcon}
          size={180}
          color={colors.accent}
          style={{ position: 'absolute', right: -40, bottom: -40, opacity: 0.08 }}
        />
      )}
      {badgeIcon && (
        <View
          style={{
            position: 'absolute',
            top: SPACING.lg,
            right: SPACING.lg,
            width: 48,
            height: 48,
            borderRadius: RADIUS.card,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={badgeIcon} size={22} color={colors.accent} />
        </View>
      )}
      {children}
    </LinearGradient>
  );
}
