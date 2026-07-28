import React, { useState } from 'react';
import { View } from 'react-native';

import { useAddInjury, useRecalculateCalories, useRemoveInjury, useSettings, useUpdateSettings } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { cmToDisplayHeight } from '@/lib/units';
import { SPACING } from '@/theme/tokens';

const GOALS = ['hypertrophy', 'strength', 'endurance', 'general_fitness', 'fat_loss'];
const EXPERIENCE = ['beginner', 'intermediate', 'advanced'];
const EQUIPMENT = ['full_gym', 'home_gym', 'bodyweight'];
const UNITS = [
  { key: 'imperial', label: 'Imperial (lb)' },
  { key: 'metric', label: 'Metric (kg)' },
];
const DIETARY = ['high_protein', 'mediterranean', 'vegetarian', 'vegan', 'low_carb', 'keto'];
const RESTRICTIONS = ['shellfish', 'peanuts', 'tree_nuts', 'dairy', 'gluten', 'soy'];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function PickerSection({ title, options, selected, onSelect }: { title: string; options: string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <View style={{ gap: SPACING.sm }}>
      <Text variant="cardTitle">{title}</Text>
      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
        {options.map((opt) => (
          <Chip key={opt} label={opt.replace('_', ' ')} selected={selected === opt} onPress={() => onSelect(opt)} />
        ))}
      </Card>
    </View>
  );
}

export function PreferencesSegment() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();
  const addInjury = useAddInjury();
  const removeInjury = useRemoveInjury();
  const recalc = useRecalculateCalories();
  const [region, setRegion] = useState('');

  if (isLoading || !settings) return <Skeleton height={300} radius={20} />;

  return (
    <View style={{ gap: SPACING.xl }}>
      <View style={{ gap: SPACING.base }}>
        <Text variant="sectionTitle">Body Stats</Text>
        <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
          <Stat label="AGE" value={settings.age != null ? `${settings.age}` : '—'} />
          <Stat label="HEIGHT" value={cmToDisplayHeight(settings.height_cm, settings.units)} />
          <Stat label="EXPERIENCE" value={settings.experience_level} />
        </Card>

        <Text variant="cardTitle">Active injuries</Text>
        {!settings.injuries.length ? (
          <EmptyState title="No active injuries" detail="Toci will substitute exercises automatically if you add one." />
        ) : (
          settings.injuries.map((injury) => (
            <Card key={injury.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text variant="bodyStrong">{injury.body_region.replace('_', ' ')}</Text>
                {injury.description && (
                  <Text variant="caption" tone="tertiary">
                    {injury.description}
                  </Text>
                )}
              </View>
              <IconButton name="close" size={16} onPress={() => removeInjury.mutate(injury.id)} />
            </Card>
          ))
        )}
        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
          <TextField placeholder="e.g. left_shoulder" value={region} onChangeText={setRegion} style={{ flex: 1 }} />
          <Button
            label="Add"
            fullWidth={false}
            size="compact"
            onPress={() => {
              if (!region.trim()) return;
              addInjury.mutate({ body_region: region.trim() });
              setRegion('');
            }}
          />
        </View>
      </View>

      <View style={{ gap: SPACING.base }}>
        <Text variant="sectionTitle">Training</Text>
        <PickerSection title="Primary goal" options={GOALS} selected={settings.goal} onSelect={(v) => update.mutate({ goal: v })} />
        <PickerSection title="Experience level" options={EXPERIENCE} selected={settings.experience_level} onSelect={(v) => update.mutate({ experience_level: v })} />
        <PickerSection title="Equipment access" options={EQUIPMENT} selected={settings.equipment} onSelect={(v) => update.mutate({ equipment: v })} />
        <Text variant="cardTitle">Units</Text>
        <Card style={{ flexDirection: 'row', gap: SPACING.sm }}>
          {UNITS.map((u) => (
            <Chip key={u.key} label={u.label} selected={settings.units === u.key} onPress={() => update.mutate({ units: u.key as 'imperial' | 'metric' })} />
          ))}
        </Card>
      </View>

      <View style={{ gap: SPACING.base }}>
        <Text variant="sectionTitle">Nutrition</Text>
        <Card style={{ gap: SPACING.sm }}>
          <Text variant="cardTitle">Daily calorie goal</Text>
          <Text variant="heroMetricSmall">{settings.daily_calorie_goal_kcal ? Math.round(settings.daily_calorie_goal_kcal) : '—'} kcal</Text>
          <Button label="Recalculate from profile" variant="secondary" size="compact" loading={recalc.isPending} onPress={() => recalc.mutate()} />
        </Card>

        <Text variant="cardTitle">Dietary style</Text>
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
          {DIETARY.map((tag) => (
            <Chip
              key={tag}
              label={tag.replace('_', ' ')}
              selected={settings.dietary_preferences.includes(tag)}
              onPress={() => update.mutate({ dietary_preferences: toggle(settings.dietary_preferences, tag) })}
            />
          ))}
        </Card>

        <Text variant="cardTitle">Food restrictions</Text>
        <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
          {RESTRICTIONS.map((tag) => (
            <Chip
              key={tag}
              label={tag.replace('_', ' ')}
              selected={settings.food_restrictions.includes(tag)}
              onPress={() => update.mutate({ food_restrictions: toggle(settings.food_restrictions, tag) })}
            />
          ))}
        </Card>

        <Text variant="cardTitle">Smart Cart settings</Text>
        <Card style={{ gap: SPACING.base, alignItems: 'center' }}>
          <Stepper label="HOUSEHOLD SIZE" value={settings.household_size} step={1} min={1} max={10} onChange={(v) => update.mutate({ household_size: v })} />
          <Stepper
            label="WEEKLY BUDGET ($)"
            value={settings.shopping_weekly_budget ?? 100}
            step={10}
            min={0}
            max={1000}
            onChange={(v) => update.mutate({ shopping_weekly_budget: v })}
          />
        </Card>
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text variant="bodyStrong">{value}</Text>
      <Text variant="microLabel" tone="tertiary">
        {label}
      </Text>
    </View>
  );
}
