import React from 'react';
import { View } from 'react-native';

import { useSpotifyStatus, useWearableStatus } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { DeviceRow } from '@/features/profile/DeviceRow';
import { SPACING } from '@/theme/tokens';

export function DevicesSegment() {
  const { data: spotify } = useSpotifyStatus();
  const { data: wearable } = useWearableStatus();

  return (
    <View style={{ gap: SPACING.base }}>
      <Card style={{ gap: 0 }}>
        <DeviceRow icon="watch-outline" name="Whoop" detail={wearable?.connected ? 'Connected' : 'Not connected'} connected={!!wearable?.connected} />
        <DeviceRow icon="musical-notes-outline" name="Spotify" detail={spotify?.connected ? 'Connected' : 'Not connected'} connected={!!spotify?.connected} />
        <DeviceRow icon="fitness-outline" name="Apple Health / Health Connect" detail="Planned" connected={false} />
      </Card>

      <Text variant="caption" tone="tertiary">
        Connecting Whoop or Spotify uses a browser-based sign-in managed from the web app for now — this screen
        reflects your real connection status either way.
      </Text>
    </View>
  );
}
