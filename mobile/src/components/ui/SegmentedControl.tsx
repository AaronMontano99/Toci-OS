import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

interface Segment {
  key: string;
  label: string;
}

interface SegmentedControlProps {
  segments: Segment[];
  selected: string;
  onChange: (key: string) => void;
}

export function SegmentedControl({ segments, selected, onChange }: SegmentedControlProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.track, { backgroundColor: colors.backgroundSecondary }]}>
      {segments.map((segment) => {
        const isActive = segment.key === selected;
        return (
          <Pressable
            key={segment.key}
            onPress={() => {
              if (segment.key !== selected) {
                Haptics.selectionAsync().catch(() => {});
                onChange(segment.key);
              }
            }}
            style={[
              styles.segment,
              isActive && {
                backgroundColor: colors.card,
                shadowColor: '#523B25',
                shadowOpacity: 0.08,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: isActive ? 2 : 0,
              },
            ]}
          >
            <Text
              variant="caption"
              style={{ fontWeight: '600', color: isActive ? colors.accentInk : colors.textSecondary }}
              numberOfLines={1}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: RADIUS.input,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
    borderRadius: RADIUS.input - 2,
    alignItems: 'center',
  },
});
