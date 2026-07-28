import React from 'react';
import { TextInput, TextInputProps, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

interface TextFieldProps extends TextInputProps {
  label?: string;
}

export function TextField({ label, style, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: SPACING.xs }}>
      {label && (
        <Text variant="caption" tone="tertiary">
          {label}
        </Text>
      )}
      <TextInput
        placeholderTextColor={colors.textDisabled}
        style={[
          {
            backgroundColor: colors.input,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: RADIUS.input,
            paddingHorizontal: SPACING.base,
            minHeight: 48,
            color: colors.textPrimary,
            fontSize: 15,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}
