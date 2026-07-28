import React from 'react';
import { View } from 'react-native';

import { Settings } from '@/api/types';
import { ActivityLevelCard } from '@/features/profile/ActivityLevelCard';
import { AppearanceCard } from '@/features/profile/AppearanceCard';
import { ConnectedDevicesPreviewCard } from '@/features/profile/ConnectedDevicesPreviewCard';
import { CurrentStatsCard } from '@/features/profile/CurrentStatsCard';
import { DailyTargetCard } from '@/features/profile/DailyTargetCard';
import { SPACING } from '@/theme/tokens';

interface ProfileOverviewSegmentProps {
  settings: Settings;
  onOpenPreferences: () => void;
  onOpenDevices: () => void;
}

export function ProfileOverviewSegment({ settings, onOpenPreferences, onOpenDevices }: ProfileOverviewSegmentProps) {
  return (
    <View style={{ gap: SPACING.base }}>
      <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
        <CurrentStatsCard />
        <DailyTargetCard onEdit={onOpenPreferences} />
      </View>
      <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
        <ActivityLevelCard activityLevel={settings.activity_level} onEdit={onOpenPreferences} />
        <ConnectedDevicesPreviewCard onManage={onOpenDevices} />
      </View>
      <AppearanceCard />
    </View>
  );
}
