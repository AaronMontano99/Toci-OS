import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { ReadinessBand } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { RingGauge } from '@/components/ui/RingGauge';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

interface ReadinessCardProps {
  score: number;
  band: ReadinessBand;
  checkedIn: boolean;
}

const BAND_COPY: Record<ReadinessBand, { label: string; interpretation: string }> = {
  green: { label: 'Ready', interpretation: "Energy is high — today's full session is cleared." },
  amber: { label: 'Moderate', interpretation: 'Energy is decent — solid day to train.' },
  red: { label: 'Low', interpretation: 'Energy is low — today leans toward active recovery.' },
};

export function ReadinessCard({ score, band, checkedIn }: ReadinessCardProps) {
  const { colors } = useTheme();
  const bandColor = { green: colors.sage, amber: colors.warmAmber, red: colors.mutedTerracotta }[band];

  return (
    <Pressable onPress={() => router.push('/checkin')}>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.base, backgroundColor: colors.accentWash, borderColor: colors.accentBorder }}>
        <RingGauge size={64} strokeWidth={6} progress={score / 100} color={bandColor} trackColor={colors.accentBorder}>
          <Text variant="bodyStrong" style={{ color: colors.accentInk }}>
            {Math.round(score)}
          </Text>
          <Text variant="microLabel" style={{ fontSize: 8, color: colors.accentInk, opacity: 0.7 }}>
            /100
          </Text>
        </RingGauge>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" style={{ fontWeight: '700', color: colors.accentInk }}>
            Readiness
          </Text>
          <Text variant="cardTitle" style={{ color: colors.accentInk }}>
            {checkedIn ? BAND_COPY[band].label : `${BAND_COPY[band].label} · check in`}
          </Text>
          <Text variant="caption" style={{ color: colors.accentInk, opacity: 0.85 }}>
            {BAND_COPY[band].interpretation}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.accentInk} />
      </Card>
    </Pressable>
  );
}
