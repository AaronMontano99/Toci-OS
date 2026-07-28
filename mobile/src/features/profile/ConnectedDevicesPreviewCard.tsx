import React from 'react';
import { Pressable, View } from 'react-native';

import { useSpotifyStatus, useWearableStatus } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { DeviceRow } from '@/features/profile/DeviceRow';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

export function ConnectedDevicesPreviewCard({ onManage }: { onManage: () => void }) {
  const { colors } = useTheme();
  const { data: spotify } = useSpotifyStatus();
  const { data: wearable } = useWearableStatus();

  return (
    <Card style={{ gap: SPACING.xs, flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="microLabel" tone="accent">
          CONNECTED DEVICES
        </Text>
        <Text style={{ color: colors.accentInk, fontSize: 16 }}>+</Text>
      </View>
      <DeviceRow icon="watch-outline" name="Whoop" detail={wearable?.connected ? 'Connected' : 'Not connected'} connected={!!wearable?.connected} />
      <DeviceRow icon="musical-notes-outline" name="Spotify" detail={spotify?.connected ? 'Connected' : 'Not connected'} connected={!!spotify?.connected} />
      <Pressable onPress={onManage}>
        <Text variant="caption" style={{ color: colors.accentInk, fontWeight: '700', marginTop: 4 }}>
          Manage Devices →
        </Text>
      </Pressable>
    </Card>
  );
}
