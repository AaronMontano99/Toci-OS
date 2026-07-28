import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  ActivityIndicator,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING, shadow } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
type Size = 'default' | 'compact';

interface ButtonProps {
  label: string;
  onPress?: (event: GestureResponderEvent) => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  haptics?: boolean;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'default',
  disabled,
  loading,
  icon,
  style,
  haptics = true,
  fullWidth = true,
}: ButtonProps) {
  const { colors, colorScheme } = useTheme();
  const height = size === 'compact' ? 46 : 54;

  const handlePress = (event: GestureResponderEvent) => {
    if (disabled || loading) return;
    if (haptics) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.(event);
  };

  const content = (
    <View style={styles.content}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onAccent : colors.accentInk} />
      ) : (
        <>
          {icon}
          <Text
            variant="button"
            tone={variant === 'primary' ? 'onAccent' : variant === 'destructive' ? 'inherit' : 'accent'}
            style={variant === 'destructive' ? { color: colors.mutedTerracotta } : undefined}
          >
            {label}
          </Text>
        </>
      )}
    </View>
  );

  if (variant === 'primary') {
    return (
      <Pressable
        onPress={handlePress}
        disabled={disabled || loading}
        style={({ pressed }) => [
          { opacity: disabled ? 0.5 : pressed ? 0.9 : 1, width: fullWidth ? '100%' : undefined },
          style,
        ]}
      >
        <LinearGradient
          colors={colors.accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.base,
            { height, borderRadius: RADIUS.button },
            shadow('card', colorScheme),
          ]}
        >
          {content}
        </LinearGradient>
      </Pressable>
    );
  }

  const backgroundColor =
    variant === 'secondary' ? colors.accentWash : variant === 'destructive' ? 'transparent' : 'transparent';
  const borderColor = variant === 'secondary' ? colors.accentBorder : 'transparent';

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          height: variant === 'tertiary' ? undefined : height,
          borderRadius: RADIUS.button,
          backgroundColor,
          borderWidth: variant === 'secondary' ? 1.5 : 0,
          borderColor,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          width: fullWidth ? '100%' : undefined,
          paddingVertical: variant === 'tertiary' ? SPACING.sm : 0,
        },
        style,
      ]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
});
