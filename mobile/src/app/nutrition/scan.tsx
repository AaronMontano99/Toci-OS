import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { useLogFood, useLookupBarcode } from '@/api/hooks';
import { FoodItem } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

function inferMealSlot(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export default function ScanBarcodeScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { colors } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const lookup = useLookupBarcode();
  const logFood = useLogFood();
  const [scanned, setScanned] = useState(false);
  const [food, setFood] = useState<FoodItem | null>(null);
  const [notFound, setNotFound] = useState(false);

  const onScanned = async (result: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    try {
      const item = await lookup.mutateAsync(result.data);
      setFood(item);
    } catch {
      setNotFound(true);
    }
  };

  if (!permission) return null;

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: SPACING.base, padding: SPACING.xl }}>
        <Text variant="cardTitle" center>
          Camera access needed to scan barcodes
        </Text>
        <Button label="Grant Camera Access" onPress={requestPermission} />
        <Button label="Cancel" variant="tertiary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={scanned ? undefined : onScanned}
      />
      <View style={{ position: 'absolute', top: 56, left: SPACING.base }}>
        <IconButton name="close" onPress={() => router.back()} background />
      </View>

      {(food || notFound) && (
        <View style={{ position: 'absolute', bottom: SPACING.xl, left: SPACING.base, right: SPACING.base }}>
          <Card style={{ gap: SPACING.sm }}>
            {food ? (
              <>
                <Text variant="cardTitle">{food.name}</Text>
                <Text variant="caption" tone="tertiary">
                  {Math.round(food.calories)} kcal · {food.serving_qty}
                  {food.serving_unit}
                </Text>
                <Button
                  label="Log this food"
                  loading={logFood.isPending}
                  onPress={async () => {
                    await logFood.mutateAsync({ food_item_id: food.id, servings: 1, meal_slot: inferMealSlot(), date });
                    router.back();
                  }}
                />
              </>
            ) : (
              <>
                <Text variant="cardTitle">No product found</Text>
                <Text variant="caption" tone="tertiary">
                  This barcode isn&rsquo;t in the catalog yet. Add it as a custom food to log it and save it for next time.
                </Text>
                <Button
                  label="Add as Custom Food"
                  onPress={() => router.push(date ? `/nutrition/custom-food?date=${date}` : '/nutrition/custom-food')}
                />
                <Button
                  label="Try again"
                  variant="secondary"
                  onPress={() => {
                    setScanned(false);
                    setNotFound(false);
                  }}
                />
              </>
            )}
          </Card>
        </View>
      )}
    </View>
  );
}
