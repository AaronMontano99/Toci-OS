import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useBodyWeightHistory, useDeleteBodyWeight, useLogBodyWeight, useSettings, useUpdateBodyWeight } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Sparkline } from '@/components/ui/Sparkline';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { kgToDisplay, displayToKg, weightUnitLabel, Units } from '@/lib/units';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

export function BodyCompPanel() {
  const { colors } = useTheme();
  const { data: history } = useBodyWeightHistory(60);
  const { data: settings } = useSettings();
  const logWeight = useLogBodyWeight();
  const updateWeight = useUpdateBodyWeight();
  const deleteWeight = useDeleteBodyWeight();
  const [editingId, setEditingId] = useState<number | null>(null);
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

      {points.length > 0 && (
        <View style={{ gap: SPACING.sm }}>
          <Text variant="sectionTitle">History</Text>
          {[...points]
            .reverse()
            .map((point) =>
              editingId === point.id ? (
                <EditingWeightRow
                  key={point.id}
                  point={point}
                  units={units}
                  onSave={(weight_kg) => {
                    updateWeight.mutate({ entryId: point.id, weight_kg });
                    setEditingId(null);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <WeightRow
                  key={point.id}
                  point={point}
                  units={units}
                  onEdit={() => setEditingId(point.id)}
                  onDelete={() => deleteWeight.mutate(point.id)}
                />
              ),
            )}
        </View>
      )}
    </View>
  );
}

// Tap a past weigh-in to fix a typo'd entry or remove one logged by mistake
// -- the sparkline above only ever showed a chart, no way to touch a point.
function WeightRow({
  point,
  units,
  onEdit,
  onDelete,
}: {
  point: { id: number; date: string; weight_kg: number };
  units: Units;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Pressable onPress={onEdit} style={{ flex: 1 }}>
        <Text variant="bodyStrong">
          {kgToDisplay(point.weight_kg, units).toFixed(1)} {weightUnitLabel(units)}
        </Text>
        <Text variant="caption" tone="tertiary">
          {point.date}
        </Text>
      </Pressable>
      <IconButton name="trash-outline" size={16} onPress={onDelete} />
    </Card>
  );
}

function EditingWeightRow({
  point,
  units,
  onSave,
  onCancel,
}: {
  point: { id: number; date: string; weight_kg: number };
  units: Units;
  onSave: (weight_kg: number) => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(Math.round(kgToDisplay(point.weight_kg, units) * 10) / 10);

  return (
    <Card style={{ gap: SPACING.sm, backgroundColor: colors.backgroundSecondary, alignItems: 'center' }}>
      <Text variant="caption" tone="tertiary">
        Editing {point.date}
      </Text>
      <Stepper
        value={draft}
        step={units === 'imperial' ? 0.5 : 0.25}
        min={50}
        max={500}
        formatValue={(v) => v.toFixed(1)}
        onChange={setDraft}
      />
      <View style={{ flexDirection: 'row', gap: SPACING.sm, width: '100%' }}>
        <Pressable
          onPress={() => onSave(displayToKg(draft, units))}
          style={{ flex: 1, alignItems: 'center', paddingVertical: SPACING.sm, borderRadius: RADIUS.input, backgroundColor: colors.accent }}
        >
          <Text variant="bodyStrong" style={{ color: colors.onAccent }}>
            Save
          </Text>
        </Pressable>
        <Pressable onPress={onCancel} style={{ flex: 1, alignItems: 'center', paddingVertical: SPACING.sm }}>
          <Text variant="bodyStrong" style={{ color: colors.textSecondary }}>
            Cancel
          </Text>
        </Pressable>
      </View>
    </Card>
  );
}
