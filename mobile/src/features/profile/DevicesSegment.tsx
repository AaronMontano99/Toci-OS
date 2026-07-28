import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useSpotifyStatus, useWearableStatus } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { DeviceConnectSheet } from '@/features/profile/DeviceConnectSheet';
import { DeviceRow } from '@/features/profile/DeviceRow';
import { SPACING } from '@/theme/tokens';

export function DevicesSegment() {
  const { data: spotify } = useSpotifyStatus();
  const { data: wearable } = useWearableStatus();
  const [openSheet, setOpenSheet] = useState<'whoop' | 'spotify' | null>(null);

  return (
    <View style={{ gap: SPACING.base }}>
      <Card style={{ gap: 0 }}>
        <Pressable onPress={() => setOpenSheet('whoop')}>
          <DeviceRow icon="watch-outline" name="Whoop" detail={wearable?.connected ? 'Connected' : 'Not connected'} connected={!!wearable?.connected} />
        </Pressable>
        <Pressable onPress={() => setOpenSheet('spotify')}>
          <DeviceRow icon="musical-notes-outline" name="Spotify" detail={spotify?.connected ? 'Connected' : 'Not connected'} connected={!!spotify?.connected} />
        </Pressable>
        <DeviceRow icon="fitness-outline" name="Apple Health / Health Connect" detail="Planned" connected={false} />
      </Card>

      <Text variant="caption" tone="tertiary">
        Tap Whoop or Spotify to connect your own account — this screen reflects your real connection status either
        way.
      </Text>

      <DeviceConnectSheet provider="whoop" visible={openSheet === 'whoop'} onClose={() => setOpenSheet(null)} />
      <DeviceConnectSheet provider="spotify" visible={openSheet === 'spotify'} onClose={() => setOpenSheet(null)} />
    </View>
  );
}
