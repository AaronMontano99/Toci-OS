import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { useGoals } from '@/api/hooks';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { GoalsSegment } from '@/features/program/GoalsSegment';
import { SPACING } from '@/theme/tokens';

export default function GoalsScreen() {
  const { data: goals, isLoading } = useGoals();

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <IconButton name="chevron-back" onPress={() => router.back()} />
        <Text variant="screenTitle">Goals</Text>
      </View>
      {isLoading || !goals ? <Skeleton height={160} radius={20} /> : <GoalsSegment goals={goals} />}
    </ScreenContainer>
  );
}
