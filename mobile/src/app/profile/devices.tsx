import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { useSpotifyStatus, useWearableStatus } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

function StatusChip({ connected }: { connected: boolean }) {
  const { colors } = useTheme();
  const color = connected ? colors.sage : colors.textTertiary;
  return (
    <View style={{ paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: 9999, backgroundColor: `${color}22` }}>
      <Text variant="caption" style={{ fontWeight: '700', color }}>
        {connected ? 'Connected' : 'Not connected'}
      </Text>
    </View>
  );
}

export default function DevicesScreen() {
  const { data: spotify } = useSpotifyStatus();
  const { data: wearable } = useWearableStatus();

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <IconButton name="chevron-back" onPress={() => router.back()} />
        <Text variant="screenTitle">Devices</Text>
      </View>

      <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text variant="cardTitle">Whoop</Text>
          <Text variant="caption" tone="tertiary">
            Recovery, HRV, and strain data
          </Text>
        </View>
        <StatusChip connected={!!wearable?.connected} />
      </Card>

      <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text variant="cardTitle">Spotify</Text>
          <Text variant="caption" tone="tertiary">
            Now-playing on the Today tab
          </Text>
        </View>
        <StatusChip connected={!!spotify?.connected} />
      </Card>

      <Card style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text variant="cardTitle">Apple Health / Health Connect</Text>
          <Text variant="caption" tone="tertiary">
            Planned — see docs/architecture.md
          </Text>
        </View>
        <StatusChip connected={false} />
      </Card>

      <Text variant="caption" tone="tertiary">
        Connecting Whoop or Spotify uses a browser-based sign-in and is managed from the web app for now — this
        screen reflects your connection status either way.
      </Text>
    </ScreenContainer>
  );
}
