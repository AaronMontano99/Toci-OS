import React, { useState } from 'react';
import { View } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { BodyCompPanel } from '@/features/progress/BodyCompPanel';
import { ConsistencyPanel } from '@/features/progress/ConsistencyPanel';
import { PRList } from '@/features/progress/PRList';
import { RunningPanel } from '@/features/progress/RunningPanel';
import { StrengthPanel } from '@/features/progress/StrengthPanel';

const CATEGORIES = [
  { key: 'strength', label: 'Strength' },
  { key: 'running', label: 'Running' },
  { key: 'body', label: 'Body' },
  { key: 'consistency', label: 'Habits' },
];

const TAGLINE: Record<string, string> = {
  strength: 'Track your strength. Celebrate your wins.',
  running: 'Track your pace and watch it drop.',
  body: 'Track your body composition over time.',
  consistency: 'Track your training and nutrition consistency.',
};

export default function ProgressScreen() {
  const [category, setCategory] = useState('strength');

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text variant="displayLarge">Progress</Text>
          <Text variant="body" tone="secondary">
            {TAGLINE[category]}
          </Text>
        </View>
        <IconButton name="options-outline" />
      </View>
      <SegmentedControl segments={CATEGORIES} selected={category} onChange={setCategory} />
      {category === 'strength' && <StrengthPanel />}
      {category === 'running' && <RunningPanel />}
      {category === 'body' && <BodyCompPanel />}
      {category === 'consistency' && <ConsistencyPanel />}
      <PRList />
    </ScreenContainer>
  );
}
