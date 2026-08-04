import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

interface PaywallCardProps {
  title: string;
  detail: string;
}

// Drop-in replacement for a feature's real UI when the user isn't premium --
// same Card shell every locked feature uses, so "this is a paid feature"
// reads consistently everywhere it shows up.
export function PaywallCard({ title, detail }: PaywallCardProps) {
  const { colors } = useTheme();
  return (
    <Card style={{ gap: SPACING.sm, alignItems: 'center', paddingVertical: SPACING.xl }}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: colors.accentWash,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="lock-closed" size={20} color={colors.accentInk} />
      </View>
      <Text variant="cardTitle" center>
        {title}
      </Text>
      <Text variant="caption" tone="tertiary" center style={{ maxWidth: 260 }}>
        {detail}
      </Text>
      <Button label="Unlock with Toci Premium" size="compact" onPress={() => router.push('/subscription')} style={{ marginTop: SPACING.xs }} />
    </Card>
  );
}
