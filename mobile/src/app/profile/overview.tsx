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
import { cmToDisplayHeight, formatWeight } from '@/lib/units';
import { SPACING } from '@/theme/tokens';

export default function ProfileOverviewScreen() {
  const { data: settings } = useSettings();

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <IconButton name="chevron-back" onPress={() => router.back()} />
        <Text variant="screenTitle">Overview</Text>
      </View>

      <Card style={{ paddingVertical: 0 }}>
        <ListRow label="Age" detail={settings?.age != null ? `${settings.age}` : '—'} showChevron={false} />
        <ListRow label="Height" detail={cmToDisplayHeight(settings?.height_cm, settings?.units ?? 'imperial')} showChevron={false} />
        <ListRow
          label="Current weight"
          detail={settings ? formatWeight(settings.current_weight_kg, settings.units) : '—'}
          showChevron={false}
        />
        <ListRow label="Experience" detail={settings ? titleCase(settings.experience_level) : '—'} showChevron={false} />
        <ListRow label="Activity level" detail={settings?.activity_level ? titleCase(settings.activity_level) : '—'} showChevron={false} />
        <ListRow label="Sex" detail={settings?.sex ? titleCase(settings.sex) : '—'} showChevron={false} />
      </Card>
    </ScreenContainer>
  );
}
