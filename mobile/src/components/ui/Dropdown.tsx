import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING, shadow } from '@/theme/tokens';

interface DropdownOption {
  key: string;
  label: string;
}

interface DropdownProps {
  options: DropdownOption[];
  selected: string;
  onChange: (key: string) => void;
  compact?: boolean;
}

// A lightweight in-flow dropdown (no portal/modal) -- taps toggle an inline
// list beneath the trigger. Used for the exercise and timeframe selectors on
// Progress instead of a native picker, to keep full control over styling.
export function Dropdown({ options, selected, onChange, compact }: DropdownProps) {
  const { colors, colorScheme } = useTheme();
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.key === selected)?.label ?? selected;

  return (
    <View>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: SPACING.xs,
          alignSelf: 'flex-start',
          paddingHorizontal: compact ? SPACING.sm : SPACING.base,
          paddingVertical: compact ? 6 : SPACING.sm,
          borderRadius: compact ? RADIUS.pill : RADIUS.input,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <Text variant={compact ? 'caption' : 'bodyStrong'} numberOfLines={1}>
          {selectedLabel}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={compact ? 12 : 16} color={colors.textTertiary} />
      </Pressable>

      {open && (
        <View
          style={[
            {
              marginTop: 4,
              borderRadius: RADIUS.input,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              maxHeight: 240,
              overflow: 'hidden',
            },
            shadow('elevated', colorScheme),
          ]}
        >
          <ScrollView>
            {options.map((opt) => (
              <Pressable
                key={opt.key}
                onPress={() => {
                  onChange(opt.key);
                  setOpen(false);
                }}
                style={{
                  paddingHorizontal: SPACING.base,
                  paddingVertical: SPACING.sm,
                  backgroundColor: opt.key === selected ? colors.accentWash : 'transparent',
                }}
              >
                <Text variant="body" style={opt.key === selected ? { color: colors.accentInk, fontWeight: '700' } : undefined}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
