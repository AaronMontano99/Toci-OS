import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { useSettings, useUpdateSettings } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { SPACING } from '@/theme/tokens';

const GOALS = ['hypertrophy', 'strength', 'endurance', 'general_fitness', 'fat_loss'];
const EXPERIENCE = ['beginner', 'intermediate', 'advanced'];
const EQUIPMENT = ['full_gym', 'home_gym', 'bodyweight'];
const UNITS = [
  { key: 'imperial', label: 'Imperial (lb)' },
  { key: 'metric', label: 'Metric (kg)' },
];

export default function TrainingPreferencesScreen() {
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <IconButton name="chevron-back" onPress={() => router.back()} />
        <Text variant="screenTitle">Training Preferences</Text>
      </View>

      {isLoading || !settings ? (
        <Skeleton height={240} radius={20} />
      ) : (
        <>
          <PickerSection
            title="Primary goal"
            options={GOALS}
            selected={settings.goal}
            onSelect={(v) => update.mutate({ goal: v })}
          />
          <PickerSection
            title="Experience level"
            options={EXPERIENCE}
            selected={settings.experience_level}
            onSelect={(v) => update.mutate({ experience_level: v })}
          />
          <PickerSection
            title="Equipment access"
            options={EQUIPMENT}
            selected={settings.equipment}
            onSelect={(v) => update.mutate({ equipment: v })}
          />
          <View style={{ gap: SPACING.sm }}>
            <Text variant="sectionTitle">Units</Text>
            <Card style={{ flexDirection: 'row', gap: SPACING.sm }}>
              {UNITS.map((u) => (
                <Chip key={u.key} label={u.label} selected={settings.units === u.key} onPress={() => update.mutate({ units: u.key as any })} />
              ))}
            </Card>
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

function PickerSection({
  title,
  options,
  selected,
  onSelect,
}: {
  title: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={{ gap: SPACING.sm }}>
      <Text variant="sectionTitle">{title}</Text>
      <Card style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm }}>
        {options.map((opt) => (
          <Chip key={opt} label={opt.replace('_', ' ')} selected={selected === opt} onPress={() => onSelect(opt)} />
        ))}
      </Card>
    </View>
  );
}
