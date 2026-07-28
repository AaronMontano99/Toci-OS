import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { FoodPanel } from '@/features/nutrition/FoodPanel';
import { SPACING } from '@/theme/tokens';

export default function AddFoodScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <IconButton name="close" onPress={() => router.back()} />
        <Text variant="screenTitle">Add Food</Text>
      </View>
      <FoodPanel date={date} />
    </ScreenContainer>
  );
}
