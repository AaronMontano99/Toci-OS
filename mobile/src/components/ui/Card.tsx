import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING, shadow } from '@/theme/tokens';

interface CardProps extends ViewProps {
  variant?: 'standard' | 'hero' | 'flat';
  padded?: boolean;
}

export function Card({ variant = 'standard', padded = true, style, children, ...rest }: CardProps) {
  const { colors, colorScheme } = useTheme();
  const radius = variant === 'hero' ? RADIUS.hero : RADIUS.card;
  const padding = padded ? (variant === 'hero' ? SPACING.xl : SPACING.base) : 0;

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: colors.card,
          borderRadius: radius,
          padding,
          borderColor: colors.border,
        },
        variant !== 'flat' && shadow('card', colorScheme),
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
