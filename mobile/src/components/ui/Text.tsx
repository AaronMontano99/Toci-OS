import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { TYPE } from '@/theme/tokens';

type Variant = keyof typeof TYPE;
type Tone = 'primary' | 'secondary' | 'tertiary' | 'disabled' | 'accent' | 'onAccent' | 'inherit';

interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  center?: boolean;
}

export function Text({ variant = 'body', tone = 'primary', center, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  const toneColor = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    tertiary: colors.textTertiary,
    disabled: colors.textDisabled,
    accent: colors.accentInk,
    onAccent: colors.onAccent,
    inherit: undefined,
  }[tone];

  return (
    <RNText
      style={[TYPE[variant], toneColor ? { color: toneColor } : null, center && { textAlign: 'center' }, style]}
      {...rest}
    />
  );
}
