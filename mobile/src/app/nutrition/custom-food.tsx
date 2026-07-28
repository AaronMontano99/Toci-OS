import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';

import { useCreateCustomFood, useLogFood } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Stepper } from '@/components/ui/Stepper';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { SPACING } from '@/theme/tokens';

function inferMealSlot(): string {
  const hour = new Date().getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 16) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

export default function CustomFoodScreen() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const createFood = useCreateCustomFood();
  const logFood = useLogFood();

  const [name, setName] = useState('');
  const [servingQty, setServingQty] = useState(1);
  const [servingUnit, setServingUnit] = useState('serving');
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);

  const saving = createFood.isPending || logFood.isPending;

  const onSave = async () => {
    if (!name.trim()) return;
    const food = await createFood.mutateAsync({
      name: name.trim(),
      serving_qty: servingQty,
      serving_unit: servingUnit.trim() || 'serving',
      calories,
      protein_g: protein,
      carbs_g: carbs,
      fat_g: fat,
    });
    await logFood.mutateAsync({ food_item_id: food.id, servings: 1, meal_slot: inferMealSlot(), date });
    router.back();
  };

  return (
    <ScreenContainer scroll contentContainerStyle={{ gap: SPACING.base }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <IconButton name="close" onPress={() => router.back()} />
        <Text variant="screenTitle">Custom Food</Text>
      </View>

      <Card style={{ gap: SPACING.sm }}>
        <TextField placeholder="Food name" value={name} onChangeText={setName} autoFocus />
        <TextField placeholder="Serving unit (e.g. cup, slice)" value={servingUnit} onChangeText={setServingUnit} />
      </Card>

      <Card style={{ gap: SPACING.base }}>
        <Stepper label="SERVING SIZE" value={servingQty} step={0.5} min={0.25} formatValue={(v) => v.toFixed(2)} onChange={setServingQty} />
        <Stepper label="CALORIES" value={calories} step={10} min={0} onChange={setCalories} />
        <Stepper label="PROTEIN (G)" value={protein} step={1} min={0} onChange={setProtein} />
        <Stepper label="CARBS (G)" value={carbs} step={1} min={0} onChange={setCarbs} />
        <Stepper label="FAT (G)" value={fat} step={1} min={0} onChange={setFat} />
      </Card>

      <Button label="Save & Log" onPress={onSave} loading={saving} />
    </ScreenContainer>
  );
}
