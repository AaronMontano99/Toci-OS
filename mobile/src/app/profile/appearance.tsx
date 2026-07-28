import { router } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { ACCENT_ORDER, ACCENT_THEMES, AccentKey, RADIUS, SPACING } from '@/theme/tokens';

const APPEARANCE_OPTIONS = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

function AccentSwatch({ accentKey, selected, onPress }: { accentKey: AccentKey; selected: boolean; onPress: () => void }) {
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
        backgroundColor: selected ? colors.accentWash : colors.card,
        minHeight: 44,
      }}
    >
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: tokens.accent, borderWidth: 1, borderColor: '#00000014' }} />
      <Text variant="caption" style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>
        {tokens.label.replace('Toci ', '')}
        {accentKey === 'apricot' ? ' (Default)' : ''}
      </Text>
      {selected && <Text style={{ color: colors.accentInk, fontWeight: '700' }}>✓</Text>}
    </Pressable>
  );
}

export default function AppearanceScreen() {
  const { appearance, accentTheme, setAppearance, setAccentTheme, colors } = useTheme();

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <IconButton name="chevron-back" onPress={() => router.back()} />
        <Text variant="screenTitle">Appearance</Text>
      </View>

      <View style={{ gap: SPACING.sm }}>
        <Text variant="sectionTitle">Appearance</Text>
        <SegmentedControl segments={APPEARANCE_OPTIONS} selected={appearance} onChange={(v) => setAppearance(v as any)} />
      </View>

      <View style={{ gap: SPACING.sm }}>
        <Text variant="sectionTitle">Accent Color</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
          {ACCENT_ORDER.map((key) => (
            <AccentSwatch key={key} accentKey={key} selected={key === accentTheme} onPress={() => setAccentTheme(key)} />
          ))}
        </View>
      </View>

      <View style={{ gap: SPACING.sm }}>
        <Text variant="sectionTitle">Preview</Text>
        <Card style={{ gap: SPACING.sm }}>
          <Button label="Start Workout" size="compact" onPress={() => {}} haptics={false} />
          <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.backgroundSecondary, overflow: 'hidden' }}>
            <View style={{ width: '65%', height: '100%', backgroundColor: colors.accent }} />
          </View>
        </Card>
      </View>

      {accentTheme !== 'apricot' && (
        <Button label="Use Toci Default" variant="tertiary" onPress={() => setAccentTheme('apricot')} />
      )}
    </ScreenContainer>
  );
}
