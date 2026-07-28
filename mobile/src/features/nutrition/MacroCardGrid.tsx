import React from 'react';
import { View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { SPACING } from '@/theme/tokens';

interface MacroCard {
  icon: string;
  label: string;
  value: string;
  target?: string;
  progress?: number;
}

export function MacroCardGrid({ items }: { items: MacroCard[] }) {
  return (
    <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
      {items.map((item) => (
        <Card key={item.label} style={{ flex: 1, gap: 4, padding: SPACING.sm }}>
          <Text style={{ fontSize: 13 }}>{item.icon}</Text>
          <Text variant="microLabel" tone="tertiary" numberOfLines={1}>
            {item.label}
          </Text>
          <Text variant="bodyStrong" numberOfLines={1}>
            {item.value}
          </Text>
          {item.target && (
            <Text variant="caption" tone="tertiary" numberOfLines={1}>
              / {item.target}
            </Text>
          )}
          {item.progress != null && <ProgressBar progress={item.progress} height={4} />}
        </Card>
      ))}
    </View>
  );
}
