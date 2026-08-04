import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING, shadow } from '@/theme/tokens';

interface GradientHeroCardProps {
  watermarkIcon?: keyof typeof Ionicons.glyphMap;
  badgeIcon?: keyof typeof Ionicons.glyphMap;
  compact?: boolean;
  children: React.ReactNode;
}

// The dark, warm-tinted hero card used for Today's workout card and Program's
// header -- a photo-background look approximated with a gradient + a large
// faded glyph watermark rather than a stock photo, so nothing here is a
// fabricated image standing in for a real one.
export function GradientHeroCard({ watermarkIcon, badgeIcon, compact, children }: GradientHeroCardProps) {
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
          padding: compact ? SPACING.lg : SPACING.xl,
          gap: compact ? SPACING.xs : SPACING.md,
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
          size={compact ? 130 : 180}
          color={colors.accent}
          style={{ position: 'absolute', right: -40, bottom: -40, opacity: 0.08 }}
        />
      )}
      {badgeIcon && (
        <View
          style={{
            position: 'absolute',
            top: compact ? SPACING.md : SPACING.lg,
            right: compact ? SPACING.md : SPACING.lg,
            width: compact ? 36 : 48,
            height: compact ? 36 : 48,
            borderRadius: RADIUS.card,
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={badgeIcon} size={compact ? 18 : 22} color={colors.accent} />
        </View>
      )}
      {children}
    </LinearGradient>
  );
}
