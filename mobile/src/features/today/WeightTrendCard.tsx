import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { useBodyWeightHistory, useSettings } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { Sparkline } from '@/components/ui/Sparkline';
import { Text } from '@/components/ui/Text';
import { kgToDisplay, weightUnitLabel } from '@/lib/units';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

export function WeightTrendCard() {
  const { colors } = useTheme();
  const { data: history } = useBodyWeightHistory(30);
  const { data: settings } = useSettings();
  const units = settings?.units ?? 'imperial';
  const points = history?.points ?? [];

  const latest = points[points.length - 1];
  const delta = points.length >= 2 ? kgToDisplay(points[points.length - 1].weight_kg - points[0].weight_kg, units) : null;

  return (
    <Pressable onPress={() => router.push('/progress')} style={{ flex: 1 }}>
      <Card style={{ gap: SPACING.sm, flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text variant="microLabel" tone="accent">
            WEIGHT TREND
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
        </View>
        {points.length >= 2 ? (
          <Sparkline values={points.map((p) => p.weight_kg)} color={colors.accent} width={150} height={44} />
        ) : (
          <Text variant="caption" tone="tertiary">
            Log your weight to see a trend.
          </Text>
        )}
        {latest && (
          <Text variant="bodyStrong">
            {kgToDisplay(latest.weight_kg, units).toFixed(1)} {weightUnitLabel(units)}
          </Text>
        )}
        {delta != null && (
          <Text variant="caption" style={{ color: delta < 0 ? colors.sage : colors.textSecondary, fontWeight: '600' }}>
            {delta < 0 ? '↓' : delta > 0 ? '↑' : '·'} {Math.abs(delta).toFixed(1)} {weightUnitLabel(units)} this month
          </Text>
        )}
      </Card>
    </Pressable>
  );
}
