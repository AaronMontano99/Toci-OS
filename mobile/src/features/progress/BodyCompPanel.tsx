import React, { useState } from 'react';
import { View } from 'react-native';

import { useBodyWeightHistory, useLogBodyWeight, useSettings } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Sparkline } from '@/components/ui/Sparkline';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { kgToDisplay, displayToKg, weightUnitLabel } from '@/lib/units';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

export function BodyCompPanel() {
  const { colors } = useTheme();
  const { data: history } = useBodyWeightHistory(60);
  const { data: settings } = useSettings();
  const logWeight = useLogBodyWeight();
  const units = settings?.units ?? 'imperial';

  const points = history?.points ?? [];
  const latestKg = points[points.length - 1]?.weight_kg ?? settings?.current_weight_kg ?? null;
  const defaultDraftWeight = latestKg != null ? Math.round(kgToDisplay(latestKg, units) * 10) / 10 : 150;

  // `override` starts unset so the field tracks the server's latest weight as
  // it loads in; once the user nudges the stepper, their value takes over.
  const [override, setOverride] = useState<number | null>(null);
  const draftWeight = override ?? defaultDraftWeight;

  const delta =
    points.length >= 2 ? kgToDisplay(points[points.length - 1].weight_kg - points[0].weight_kg, units) : null;

  return (
    <View style={{ gap: SPACING.base }}>
      {points.length < 2 ? (
        <EmptyState title="Log your weight to see a trend" detail="Track body weight over time from here." />
      ) : (
        <Card style={{ gap: SPACING.sm }}>
          <Text variant="heroMetricSmall">
            {kgToDisplay(points[points.length - 1].weight_kg, units).toFixed(1)} {weightUnitLabel(units)}
          </Text>
          <Text variant="caption" tone="tertiary">
            CURRENT WEIGHT
          </Text>
          <Sparkline values={points.map((p) => p.weight_kg)} color={colors.plumGray} width={300} height={70} />
          {delta != null && (
            <Text variant="body" tone="secondary">
              {delta > 0 ? '+' : ''}
              {delta.toFixed(1)} {weightUnitLabel(units)} over this period.
            </Text>
          )}
        </Card>
      )}

      <Card style={{ gap: SPACING.sm, alignItems: 'center' }}>
        <Text variant="cardTitle">Log today&rsquo;s weight</Text>
        <Stepper
          value={draftWeight}
          step={units === 'imperial' ? 0.5 : 0.25}
          min={50}
          max={500}
          formatValue={(v) => v.toFixed(1)}
          onChange={setOverride}
        />
        <Button
          label="Save weight"
          size="compact"
          onPress={() => logWeight.mutate(displayToKg(draftWeight, units))}
          loading={logWeight.isPending}
        />
      </Card>
    </View>
  );
}
