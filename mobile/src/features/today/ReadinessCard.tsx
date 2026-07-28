import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { ReadinessBand } from '@/api/types';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

interface ReadinessCardProps {
  score: number;
  band: ReadinessBand;
  sleepMin: number | null;
  hrvMs: number | null;
  checkedIn: boolean;
}

const BAND_COPY: Record<ReadinessBand, { label: string; interpretation: string }> = {
  green: { label: 'Ready', interpretation: "You're recovered — today's full session is cleared." },
  amber: { label: 'Moderate', interpretation: 'Recovery is so-so — volume is trimmed a bit today.' },
  red: { label: 'Low', interpretation: 'Recovery is low — today leans toward active recovery.' },
};

export function ReadinessCard({ score, band, sleepMin, hrvMs, checkedIn }: ReadinessCardProps) {
  const { colors } = useTheme();
  const bandColor = { green: colors.sage, amber: colors.warmAmber, red: colors.mutedTerracotta }[band];
  const sleepHours = sleepMin != null ? (sleepMin / 60).toFixed(1) : null;

  return (
    <Card style={{ gap: SPACING.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="sectionTitle">Readiness</Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            backgroundColor: `${bandColor}22`,
            paddingHorizontal: SPACING.sm,
            paddingVertical: 4,
            borderRadius: 9999,
          }}
        >
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: bandColor }} />
          <Text variant="caption" style={{ fontWeight: '700', color: bandColor }}>
            {BAND_COPY[band].label}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: SPACING.xl }}>
        <View>
          <Text variant="heroMetric">{Math.round(score)}</Text>
          <Text variant="microLabel" tone="tertiary">
            SCORE
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: SPACING.lg, paddingBottom: 4 }}>
          <View>
            <Text variant="bodyStrong">{sleepHours ? `${sleepHours}h` : '—'}</Text>
            <Text variant="microLabel" tone="tertiary">
              SLEEP
            </Text>
          </View>
          <View>
            <Text variant="bodyStrong">{hrvMs != null ? Math.round(hrvMs) : '—'}</Text>
            <Text variant="microLabel" tone="tertiary">
              HRV MS
            </Text>
          </View>
        </View>
      </View>

      <Text variant="body" tone="secondary">
        {BAND_COPY[band].interpretation}
      </Text>

      {!checkedIn && (
        <Button
          label="Do today's check-in"
          variant="secondary"
          size="compact"
          onPress={() => router.push('/checkin')}
        />
      )}
    </Card>
  );
}
