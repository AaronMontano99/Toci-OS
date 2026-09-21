import React from 'react';
import { Pressable, View } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

// The thin segmented bar from the reference screenshots -- it reads as
// momentum ("almost there") without ever spelling out "Step 4 of 11", which
// would make this feel like a form.
export function OnboardingHeader({
  step,
  total,
  onBack,
  onSkip,
}: {
  step: number; // 1-based
  total: number;
  onBack?: () => void;
  onSkip?: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: SPACING.base }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
        {onBack ? <IconButton name="chevron-back" onPress={onBack} /> : <View style={{ width: 44 }} />}
        {onSkip && (
          <Pressable onPress={onSkip} hitSlop={8}>
            <Text variant="body" tone="tertiary">
              Skip
            </Text>
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: RADIUS.pill,
              backgroundColor: i < step ? colors.accent : colors.backgroundSecondary,
            }}
          />
        ))}
      </View>
    </View>
  );
}
