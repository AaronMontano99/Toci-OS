import React, { useState } from 'react';

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

export default function ProgressScreen() {
  const [category, setCategory] = useState('strength');

  return (
    <ScreenContainer>
      <Text variant="screenTitle">Progress</Text>
      <SegmentedControl segments={CATEGORIES} selected={category} onChange={setCategory} />
      {category === 'strength' && <StrengthPanel />}
      {category === 'running' && <RunningPanel />}
      {category === 'body' && <BodyCompPanel />}
      {category === 'consistency' && <ConsistencyPanel />}
      <PRList />
    </ScreenContainer>
  );
}
