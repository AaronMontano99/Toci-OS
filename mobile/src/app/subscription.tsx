import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { useSettings, useUpdateSettings } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }[] = [
  {
    icon: 'chatbubbles-outline',
    title: 'Ask Toci',
    detail: 'A real conversation with your coach about your program, goals, and history — propose changes, apply or discard them.',
  },
  {
    icon: 'trending-up-outline',
    title: 'Adaptive next-session coaching',
    detail: 'Weight and rep recommendations that adjust to how your last session actually felt, not a fixed spreadsheet.',
  },
  {
    icon: 'camera-outline',
    title: 'Progress photos',
    detail: 'Track your physique over time, with a short AI read on posture and build for every photo you add.',
  },
];

// Demo-only paywall: toggles the existing `is_premium` setting (already
// modeled server-side, see app/toci/models.py -- "demo stub, no real payment
// processor exists"). No App Store/Play Store billing wired up; this shows
// what the gating looks like without real payments behind it.
export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const { data: settings, isLoading } = useSettings();
  const update = useUpdateSettings();

  if (isLoading || !settings) {
    return (
      <ScreenContainer>
        <Skeleton height={200} radius={20} />
      </ScreenContainer>
    );
  }

  const isPremium = settings.is_premium;

  return (
    <ScreenContainer contentContainerStyle={{ gap: SPACING.base }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <IconButton name="close" onPress={() => router.back()} />
        <Text variant="screenTitle">Toci Premium</Text>
      </View>

      {isPremium ? (
        <Card style={{ gap: SPACING.sm, alignItems: 'center', backgroundColor: colors.accentWash, borderColor: colors.accentBorder }}>
          <Ionicons name="checkmark-circle" size={28} color={colors.accentInk} />
          <Text variant="cardTitle" style={{ color: colors.accentInk }} center>
            You&rsquo;re on Premium
          </Text>
          <Text variant="caption" style={{ color: colors.accentInk }} center>
            Ask Toci, adaptive next-session coaching, and progress photos are all unlocked.
          </Text>
        </Card>
      ) : (
        <Card style={{ gap: 2, alignItems: 'center' }}>
          <Text variant="heroMetricSmall">$6.99</Text>
          <Text variant="caption" tone="tertiary">
            per month
          </Text>
        </Card>
      )}

      <View style={{ gap: SPACING.sm }}>
        {FEATURES.map((f) => (
          <Card key={f.title} style={{ flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-start' }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: colors.accentWash,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={f.icon} size={17} color={colors.accentInk} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="bodyStrong">{f.title}</Text>
              <Text variant="caption" tone="tertiary">
                {f.detail}
              </Text>
            </View>
          </Card>
        ))}
      </View>

      {isPremium ? (
        <Button
          label="Cancel Premium"
          variant="tertiary"
          loading={update.isPending}
          onPress={async () => {
            await update.mutateAsync({ is_premium: false });
            router.back();
          }}
        />
      ) : (
        <Button
          label="Subscribe — $6.99/mo"
          loading={update.isPending}
          onPress={async () => {
            await update.mutateAsync({ is_premium: true });
            router.back();
          }}
        />
      )}

      <Text variant="caption" tone="tertiary" center>
        Demo only — no real payment is processed. This toggles a setting so you can see what the paid experience looks like.
      </Text>
    </ScreenContainer>
  );
}
