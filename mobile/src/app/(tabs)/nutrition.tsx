import React, { useState } from 'react';

import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Text } from '@/components/ui/Text';
import { CartPanel } from '@/features/nutrition/CartPanel';
import { FoodPanel } from '@/features/nutrition/FoodPanel';
import { RecipesPanel } from '@/features/nutrition/RecipesPanel';
import { TodayPanel } from '@/features/nutrition/TodayPanel';

const SEGMENTS = [
  { key: 'today', label: 'Today' },
  { key: 'food', label: 'Food' },
  { key: 'recipes', label: 'Recipes' },
  { key: 'cart', label: 'Smart Cart' },
];

export default function NutritionScreen() {
  const [segment, setSegment] = useState('today');

  return (
    <ScreenContainer>
      <Text variant="screenTitle">Nutrition</Text>
      <SegmentedControl segments={SEGMENTS} selected={segment} onChange={setSegment} />
      {segment === 'today' && <TodayPanel />}
      {segment === 'food' && <FoodPanel />}
      {segment === 'recipes' && <RecipesPanel />}
      {segment === 'cart' && <CartPanel />}
    </ScreenContainer>
  );
}
