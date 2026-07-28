import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { useSettings } from '@/api/hooks';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ListRow } from '@/components/ui/ListRow';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { titleCase } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { data: settings } = useSettings();
  const initial = (settings?.name || 'T').trim().charAt(0).toUpperCase();

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <IconButton name="chevron-back" onPress={() => router.back()} />
        <Text variant="screenTitle">Profile</Text>
      </View>

      <View style={{ alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.base }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: colors.accentWash,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text variant="displayLarge" style={{ color: colors.accentInk }}>
            {initial}
          </Text>
        </View>
        <Text variant="screenTitle">{settings?.name ?? '—'}</Text>
        <Text variant="body" tone="secondary">
          {settings ? `${titleCase(settings.goal)} · ${titleCase(settings.experience_level)}` : ''}
        </Text>
      </View>

      <Card style={{ gap: 0, paddingVertical: SPACING.xs }}>
        <ListRow icon="person-outline" label="Overview" detail={settings?.name} onPress={() => router.push('/profile/overview')} />
        <ListRow icon="flag-outline" label="Goals" onPress={() => router.push('/profile/goals')} />
        <ListRow icon="body-outline" label="Body Stats" onPress={() => router.push('/profile/body-stats')} />
        <ListRow icon="barbell-outline" label="Training Preferences" onPress={() => router.push('/profile/training-preferences')} />
        <ListRow icon="nutrition-outline" label="Nutrition Preferences" onPress={() => router.push('/profile/nutrition-preferences')} />
        <ListRow icon="watch-outline" label="Devices" onPress={() => router.push('/profile/devices')} />
        <ListRow icon="color-palette-outline" label="Appearance" onPress={() => router.push('/profile/appearance')} />
        <ListRow icon="settings-outline" label="Account" onPress={() => router.push('/profile/account')} showChevron />
      </Card>
    </ScreenContainer>
  );
}
