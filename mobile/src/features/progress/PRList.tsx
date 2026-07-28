import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { usePRs, useSettings } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { formatWeight } from '@/lib/units';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

export function PRList() {
  const { colors } = useTheme();
  const { data } = usePRs();
  const { data: settings } = useSettings();
  const units = settings?.units ?? 'imperial';

  if (!data?.prs.length) {
    return <EmptyState title="No PRs yet" detail="Personal records show up here as you log heavier sets or faster runs." />;
  }

  return (
    <View style={{ gap: SPACING.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="sectionTitle">Recent PRs</Text>
      </View>
      {data.prs.map((pr, i) => (
        <Card key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: RADIUS.small,
              backgroundColor: '#111214',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={pr.pace_per_km ? 'walk' : 'barbell'} size={19} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="cardTitle">{pr.exercise}</Text>
            <Text variant="caption" tone="tertiary">
              {pr.est_1rm_kg != null ? '1RM' : 'Pace'} · {pr.date}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text variant="bodyStrong">{pr.est_1rm_kg != null ? formatWeight(pr.est_1rm_kg, units, 0) : pr.pace_per_km}</Text>
            {pr.delta_kg != null && (
              <Text variant="caption" style={{ color: colors.sage, fontWeight: '700' }}>
                ▲ {formatWeight(pr.delta_kg, units, 1)}
              </Text>
            )}
          </View>
        </Card>
      ))}
    </View>
  );
}
