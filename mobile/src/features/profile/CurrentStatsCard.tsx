import { router } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { useWeeklySummary } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { SPACING } from '@/theme/tokens';

interface WeeklySummary {
  avg_daily_calories: number;
  avg_daily_protein_g: number;
  days_logged: number;
  weight_delta_kg: number | null;
}

export function CurrentStatsCard() {
  const { data } = useWeeklySummary() as { data: WeeklySummary | undefined };

  return (
    <Pressable style={{ flex: 1 }} onPress={() => router.push('/progress')}>
      <Card style={{ gap: SPACING.sm, flex: 1 }}>
        <Text variant="microLabel" tone="accent">
          CURRENT STATS · THIS WEEK
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.base }}>
          <Stat label="Calories" value={data ? `${data.avg_daily_calories}` : '—'} caption="avg / day" />
          <Stat label="Protein" value={data ? `${data.avg_daily_protein_g}g` : '—'} caption="avg / day" />
          <Stat label="Days Logged" value={data ? `${data.days_logged}/7` : '—'} caption="nutrition" />
          <Stat
            label="Weight"
            value={data?.weight_delta_kg != null ? `${data.weight_delta_kg > 0 ? '+' : ''}${data.weight_delta_kg}kg` : '—'}
            caption="this week"
          />
        </View>
      </Card>
    </Pressable>
  );
}

function Stat({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <View style={{ minWidth: '40%' }}>
      <Text variant="bodyStrong">{value}</Text>
      <Text variant="caption" tone="tertiary">
        {label}
      </Text>
      <Text variant="microLabel" tone="tertiary">
        {caption}
      </Text>
    </View>
  );
}
