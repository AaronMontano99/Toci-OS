import { router } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { useAddInjury, useRemoveInjury, useSettings } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { cmToDisplayHeight } from '@/lib/units';
import { BodyCompPanel } from '@/features/progress/BodyCompPanel';
import { SPACING } from '@/theme/tokens';

export default function BodyStatsScreen() {
  const { data: settings } = useSettings();
  const addInjury = useAddInjury();
  const removeInjury = useRemoveInjury();
  const [region, setRegion] = useState('');

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <IconButton name="chevron-back" onPress={() => router.back()} />
        <Text variant="screenTitle">Body Stats</Text>
      </View>

      <Card style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <Stat label="AGE" value={settings?.age != null ? `${settings.age}` : '—'} />
        <Stat label="HEIGHT" value={cmToDisplayHeight(settings?.height_cm, settings?.units ?? 'imperial')} />
        <Stat label="EXPERIENCE" value={settings?.experience_level ?? '—'} />
      </Card>

      <BodyCompPanel />

      <View style={{ gap: SPACING.sm }}>
        <Text variant="sectionTitle">Active injuries</Text>
        {!settings?.injuries.length ? (
          <EmptyState title="No active injuries" detail="Toci will substitute exercises automatically if you add one." />
        ) : (
          settings.injuries.map((injury) => (
            <Card key={injury.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text variant="bodyStrong">{injury.body_region.replace('_', ' ')}</Text>
                {injury.description && (
                  <Text variant="caption" tone="tertiary">
                    {injury.description}
                  </Text>
                )}
              </View>
              <IconButton name="close" size={16} onPress={() => removeInjury.mutate(injury.id)} />
            </Card>
          ))
        )}
        <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
          <TextField placeholder="e.g. left_shoulder" value={region} onChangeText={setRegion} style={{ flex: 1 }} />
          <Button
            label="Add"
            fullWidth={false}
            size="compact"
            onPress={() => {
              if (!region.trim()) return;
              addInjury.mutate({ body_region: region.trim() });
              setRegion('');
            }}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text variant="bodyStrong">{value}</Text>
      <Text variant="microLabel" tone="tertiary">
        {label}
      </Text>
    </View>
  );
}
