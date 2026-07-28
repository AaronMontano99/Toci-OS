import React from 'react';
import { View } from 'react-native';

import { usePRs, useSettings } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { formatWeight } from '@/lib/units';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

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
      <Text variant="sectionTitle">Recent PRs</Text>
      {data.prs.map((pr, i) => (
        <Card key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text variant="cardTitle">{pr.exercise}</Text>
            <Text variant="caption" tone="tertiary">
              {pr.date}
            </Text>
          </View>
          <Text variant="bodyStrong" style={{ color: colors.sage }}>
            {pr.est_1rm_kg != null ? formatWeight(pr.est_1rm_kg, units, 1) : pr.pace_per_km}
          </Text>
        </Card>
      ))}
    </View>
  );
}
