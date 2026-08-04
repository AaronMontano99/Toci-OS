import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { deepLinkToSubscriptions, ErrorCode, getAvailablePurchases, useIAP } from 'expo-iap';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { useSubscriptionStatus, useVerifyPurchase } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

// Must match the auto-renewable subscription product created in App Store
// Connect exactly -- see docs/app-store-setup.md. Kept in sync with the
// backend's own copy (toci/apple_iap.py's PRODUCT_ID_MONTHLY) manually;
// there's no shared config file between the two apps in this repo.
const PRODUCT_ID = 'com.toci.app.premium_monthly';

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

// Real Apple StoreKit 2 subscription via expo-iap -- see
// docs/app-store-setup.md for what has to exist in App Store Connect before
// any of this actually works on a device (the product, a Sandbox tester,
// and a real signed build; this screen can't be exercised in Expo Go).
export default function SubscriptionScreen() {
  const { colors } = useTheme();
  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useSubscriptionStatus();
  const verifyPurchase = useVerifyPurchase();
  const [restoring, setRestoring] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const { connected, subscriptions, fetchProducts, requestPurchase } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      if (!purchase.purchaseToken) {
        setPurchasing(false);
        Alert.alert("Couldn't confirm purchase", 'No transaction data came back from the App Store — try again.');
        return;
      }
      try {
        await verifyPurchase.mutateAsync(purchase.purchaseToken);
        await refetchStatus();
        router.back();
      } catch {
        Alert.alert(
          "Purchase went through, but we couldn't confirm it",
          'Your payment succeeded, but Toci couldn’t verify it with the App Store just now. Try "Restore Purchases" in a moment.',
        );
      } finally {
        setPurchasing(false);
      }
    },
    onPurchaseError: (error) => {
      setPurchasing(false);
      if (error.code === ErrorCode.UserCancelled) return;
      Alert.alert('Purchase failed', error.message);
    },
  });

  useEffect(() => {
    if (connected) {
      fetchProducts({ skus: [PRODUCT_ID], type: 'subs' });
    }
  }, [connected, fetchProducts]);

  const product = subscriptions.find((s) => s.id === PRODUCT_ID);
  const priceLabel = product?.displayPrice ?? '$6.99';

  const onSubscribe = async () => {
    setPurchasing(true);
    try {
      await requestPurchase({ request: { apple: { sku: PRODUCT_ID } }, type: 'subs' });
    } catch {
      // Synchronous rejections (not-prepared, validation) also surface via
      // onPurchaseError above -- this catch just stops an unhandled-rejection
      // warning; setPurchasing(false) already happens in that callback.
    }
  };

  const onRestore = async () => {
    setRestoring(true);
    try {
      const purchases = await getAvailablePurchases();
      const match = purchases.find((p) => p.productId === PRODUCT_ID && p.purchaseToken);
      if (!match?.purchaseToken) {
        Alert.alert('Nothing to restore', "No previous Toci Premium purchase was found on this Apple ID.");
        return;
      }
      await verifyPurchase.mutateAsync(match.purchaseToken);
      await refetchStatus();
      Alert.alert('Restored', 'Your Toci Premium subscription is active again.');
    } catch {
      Alert.alert("Couldn't restore purchases", 'Try again in a moment.');
    } finally {
      setRestoring(false);
    }
  };

  if (statusLoading || !status) {
    return (
      <ScreenContainer>
        <Skeleton height={200} radius={20} />
      </ScreenContainer>
    );
  }

  const isPremium = status.is_premium;

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
          {status.expires_at && (
            <Text variant="caption" style={{ color: colors.accentInk }} center>
              Renews {new Date(status.expires_at).toLocaleDateString()}
            </Text>
          )}
        </Card>
      ) : (
        <Card style={{ gap: 2, alignItems: 'center' }}>
          <Text variant="heroMetricSmall">{priceLabel}</Text>
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
        Platform.OS === 'ios' ? (
          <Button label="Manage Subscription" variant="tertiary" onPress={() => deepLinkToSubscriptions()} />
        ) : null
      ) : (
        <>
          <Button
            label={`Subscribe — ${priceLabel}/mo`}
            loading={purchasing}
            disabled={!connected}
            onPress={onSubscribe}
          />
          <Button label="Restore Purchases" variant="tertiary" loading={restoring} onPress={onRestore} />
        </>
      )}

      <Text variant="caption" tone="tertiary" center>
        Payment charged to your Apple ID at confirmation. Renews automatically unless canceled at least 24 hours
        before the current period ends — manage or cancel anytime in Settings &gt; Apple ID &gt; Subscriptions.
      </Text>
    </ScreenContainer>
  );
}
