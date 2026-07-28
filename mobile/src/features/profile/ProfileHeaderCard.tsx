import React from 'react';
import { View } from 'react-native';

import { Settings } from '@/api/types';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { cmToDisplayHeight, formatWeight } from '@/lib/units';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

const GOAL_LABEL: Record<string, string> = {
  hypertrophy: 'Build Muscle',
  strength: 'Get Stronger',
  endurance: 'Build Endurance',
  general_fitness: 'General Fitness',
  fat_loss: 'Lean & Strong',
};

export function ProfileHeaderCard({ settings }: { settings: Settings }) {
  const { colors } = useTheme();

  return (
    <Card style={{ gap: SPACING.base }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.base }}>
        <Avatar name={settings.name} size={64} editable />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="cardTitle" style={{ fontSize: 20 }}>
            {settings.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 12 }}>◆</Text>
            <Text variant="caption" tone="accent" style={{ fontWeight: '700' }}>
              TOCI Member
            </Text>
          </View>
          <Text variant="caption" tone="secondary">
            Consistency is your advantage.
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: SPACING.sm }}>
        <HeaderStat label="Age" value={settings.age != null ? `${settings.age}` : '—'} unit="years" />
        <HeaderStat label="Height" value={cmToDisplayHeight(settings.height_cm, settings.units)} />
        <HeaderStat label="Weight" value={formatWeight(settings.current_weight_kg, settings.units, 0)} />
        <HeaderStat label="Goal" value={GOAL_LABEL[settings.goal] ?? settings.goal} accent />
      </View>
    </Card>
  );
}

function HeaderStat({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 2, flex: 1 }}>
      <Text
        variant="bodyStrong"
        numberOfLines={1}
        style={accent ? { color: colors.accentInk, fontSize: 13 } : undefined}
      >
        {value}
      </Text>
      <Text variant="microLabel" tone="tertiary">
        {label.toUpperCase()}
      </Text>
      {unit && (
        <Text variant="microLabel" tone="tertiary">
          {unit}
        </Text>
      )}
    </View>
  );
}
