import React from 'react';
import { View } from 'react-native';

import { ProgramIdentity, ProgramProgress } from '@/api/types';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

const STATUS_COPY: Record<ProgramProgress['status'], { label: string; tone: 'sage' | 'warmAmber' | 'accent' }> = {
  ahead: { label: 'Ahead', tone: 'sage' },
  on_track: { label: 'On Track', tone: 'accent' },
  behind: { label: 'Behind', tone: 'warmAmber' },
};

export function ProgramHeader({ identity, progress }: { identity: ProgramIdentity; progress: ProgramProgress }) {
  const { colors } = useTheme();
  const status = STATUS_COPY[progress.status];
  const statusColor = status.tone === 'accent' ? colors.accentInk : colors[status.tone];

  return (
    <View style={{ gap: SPACING.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text variant="screenTitle">{identity.program_name}</Text>
          <Text variant="body" tone="secondary">
            {identity.focus} · Week {identity.current_week} of {identity.total_weeks}
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: SPACING.sm,
            paddingVertical: 4,
            borderRadius: 9999,
            backgroundColor: `${statusColor}22`,
          }}
        >
          <Text variant="caption" style={{ fontWeight: '700', color: statusColor }}>
            {status.label}
          </Text>
        </View>
      </View>
      <ProgressBar progress={progress.completion_pct / 100} />
      <Text variant="caption" tone="tertiary">
        {progress.completion_pct}% complete · {progress.streak} day streak
      </Text>
    </View>
  );
}
