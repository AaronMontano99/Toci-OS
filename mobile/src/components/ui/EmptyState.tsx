import React from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { SPACING } from '@/theme/tokens';

interface EmptyStateProps {
  title: string;
  detail?: string;
}

// Every empty state teaches what happens next — design-system.md §20.
export function EmptyState({ title, detail }: EmptyStateProps) {
  return (
    <View style={{ paddingVertical: SPACING.xl, paddingHorizontal: SPACING.base, alignItems: 'center', gap: SPACING.xs }}>
      <Text variant="bodyStrong" tone="secondary" center>
        {title}
      </Text>
      {detail ? (
        <Text variant="caption" tone="tertiary" center>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}
