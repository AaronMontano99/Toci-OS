import React, { useState } from 'react';

import { useGoals, useSettings } from '@/api/hooks';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { AccountSegment } from '@/features/profile/AccountSegment';
import { DevicesSegment } from '@/features/profile/DevicesSegment';
import { PreferencesSegment } from '@/features/profile/PreferencesSegment';
import { ProfileHeaderCard } from '@/features/profile/ProfileHeaderCard';
import { ProfileOverviewSegment } from '@/features/profile/ProfileOverviewSegment';
import { GoalsSegment } from '@/features/program/GoalsSegment';

const SEGMENTS = [
  { key: 'overview', label: 'Overview' },
  { key: 'goals', label: 'Goals' },
  { key: 'preferences', label: 'Prefs' },
  { key: 'devices', label: 'Devices' },
  { key: 'account', label: 'Account' },
];

export default function ProfileScreen() {
  const { data: settings, isLoading } = useSettings();
  const { data: goals } = useGoals();
  const [segment, setSegment] = useState('overview');

  return (
    <ScreenContainer>
      <ScreenHeader title="Profile" rightIcon="settings-outline" onRightPress={() => setSegment('account')} />

      {isLoading || !settings ? (
        <Skeleton height={140} radius={20} />
      ) : (
        <ProfileHeaderCard settings={settings} />
      )}

      <SegmentedControl segments={SEGMENTS} selected={segment} onChange={setSegment} />

      {settings && segment === 'overview' && (
        <ProfileOverviewSegment
          settings={settings}
          onOpenPreferences={() => setSegment('preferences')}
          onOpenDevices={() => setSegment('devices')}
        />
      )}
      {segment === 'goals' && (goals ? <GoalsSegment goals={goals} /> : <Skeleton height={160} radius={20} />)}
      {segment === 'preferences' && <PreferencesSegment />}
      {segment === 'devices' && <DevicesSegment />}
      {segment === 'account' && <AccountSegment />}
    </ScreenContainer>
  );
}
