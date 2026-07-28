import React from 'react';
import { View } from 'react-native';

import { NutritionTotals } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RingGauge } from '@/components/ui/RingGauge';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

function MacroRing({ label, pct, color }: { label: string; pct: number; color: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <RingGauge size={44} strokeWidth={5} progress={pct} color={color} trackColor={colors.border}>
        <Text variant="caption" style={{ fontWeight: '700' }}>
          {Math.round(pct * 100)}%
        </Text>
      </RingGauge>
      <Text variant="microLabel" tone="tertiary">
        {label}
      </Text>
    </View>
  );
}

export function LogFoodCard({ totals, onAddFood }: { totals: NutritionTotals; onAddFood: () => void }) {
  const { colors } = useTheme();
  const carbsKcal = totals.carbs_g * 4;
  const proteinKcal = totals.protein_g * 4;
  const fatKcal = totals.fat_g * 9;
  const totalKcal = carbsKcal + proteinKcal + fatKcal || 1;

  return (
    <Card style={{ gap: SPACING.base }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentWash, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 18, color: colors.accentInk }}>+</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="cardTitle">Log Food</Text>
          <Text variant="caption" tone="tertiary">
            Quickly add foods and keep your macros on track.
          </Text>
        </View>
        <MacroRing label="C" pct={carbsKcal / totalKcal} color={colors.recoveryBlue} />
        <MacroRing label="P" pct={proteinKcal / totalKcal} color={colors.sage} />
        <MacroRing label="F" pct={fatKcal / totalKcal} color={colors.warmAmber} />
      </View>
      <Button label="Add Food" onPress={onAddFood} />
    </Card>
  );
}
