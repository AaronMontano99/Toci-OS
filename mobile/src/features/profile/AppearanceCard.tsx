import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { ACCENT_ORDER, ACCENT_THEMES, AccentKey, AppearanceMode, RADIUS, SPACING } from '@/theme/tokens';

const APPEARANCE_OPTIONS = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

function Dot({ accentKey, selected, onPress }: { accentKey: AccentKey; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const tokens = ACCENT_THEMES[accentKey];
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={tokens.label}
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: tokens.accent,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: selected ? 2 : 0,
        borderColor: colors.textPrimary,
      }}
    >
      {selected && <Ionicons name="checkmark" size={14} color={accentKey === 'cocoa' || accentKey === 'graphite' ? '#fff' : '#202124'} />}
    </Pressable>
  );
}

function AccentGridSwatch({ accentKey, selected, onPress }: { accentKey: AccentKey; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const tokens = ACCENT_THEMES[accentKey];
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={tokens.label}
      style={{
        flexBasis: '48%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        padding: SPACING.sm,
        borderRadius: RADIUS.input,
        borderWidth: 1.5,
        borderColor: selected ? colors.accentBorder : colors.border,
        backgroundColor: selected ? colors.accentWash : colors.background,
        minHeight: 44,
      }}
    >
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: tokens.accent }} />
      <Text variant="caption" style={{ fontWeight: '600', flex: 1, color: selected ? colors.accentInk : colors.textPrimary }} numberOfLines={1}>
        {tokens.label.replace('Toci ', '')}
        {accentKey === 'apricot' ? ' (Default)' : ''}
      </Text>
      {selected && <Text style={{ color: colors.accentInk, fontWeight: '700' }}>✓</Text>}
    </Pressable>
  );
}

export function AppearanceCard() {
  const { colors, appearance, accentTheme, setAppearance, setAccentTheme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const previewOrder: AccentKey[] = ['apricot', 'blush', 'sky', 'mint'];

  return (
    <Card style={{ gap: SPACING.sm }}>
      <Pressable onPress={() => setExpanded((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentWash, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="color-palette-outline" size={18} color={colors.accentInk} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Appearance</Text>
          <Text variant="caption" tone="tertiary">
            Choose your theme
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {previewOrder.map((key) => (
            <Dot key={key} accentKey={key} selected={key === accentTheme} onPress={() => setAccentTheme(key)} />
          ))}
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-forward'} size={16} color={colors.textDisabled} />
      </Pressable>

      {expanded && (
        <View style={{ gap: SPACING.base, marginTop: SPACING.xs }}>
          <SegmentedControl segments={APPEARANCE_OPTIONS} selected={appearance} onChange={(v) => setAppearance(v as AppearanceMode)} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
            {ACCENT_ORDER.map((key) => (
              <AccentGridSwatch key={key} accentKey={key} selected={key === accentTheme} onPress={() => setAccentTheme(key)} />
            ))}
          </View>
          {accentTheme !== 'apricot' && <Button label="Use Toci Default" variant="tertiary" onPress={() => setAccentTheme('apricot')} />}
        </View>
      )}
    </Card>
  );
}
