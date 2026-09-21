import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

// The bit of "Toci is already coaching you" from the reference flow: a short
// reaction line that responds to answers already given, shown under a later
// question rather than as a generic label. Renders nothing if there's
// nothing worth reacting to yet.
export function CoachReaction({ text }: { text: string | null }) {
  const { colors } = useTheme();
  if (!text) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: SPACING.sm,
        backgroundColor: colors.accentWash,
        borderRadius: RADIUS.card,
        padding: SPACING.base,
      }}
    >
      <Ionicons name="flame" size={16} color={colors.accentInk} style={{ marginTop: 2 }} />
      <Text variant="body" style={{ color: colors.accentInk, flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}
