import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAddShoppingItem, useDeleteShoppingItem, useShopping, useToggleShoppingItem } from '@/api/hooks';
import { ShoppingItem } from '@/api/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { titleCase } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

export function CartPanel() {
  const { colors } = useTheme();
  const { data } = useShopping();
  const toggle = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();

  const items: ShoppingItem[] = data?.items ?? [];
  const byCategory = items.reduce<Record<string, ShoppingItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  const total = items.reduce((sum, i) => sum + i.estimated_price, 0);

  return (
    <View style={{ gap: SPACING.base }}>
      {items.length === 0 ? (
        <EmptyState title="Your cart is empty" detail="Add ingredients from a recipe to build your shopping list." />
      ) : (
        <>
          <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="bodyStrong">Estimated total</Text>
            <Text variant="bodyStrong">${total.toFixed(2)}</Text>
          </Card>

          {Object.entries(byCategory).map(([category, categoryItems]) => (
            <View key={category} style={{ gap: SPACING.sm }}>
              <Text variant="sectionTitle">{titleCase(category)}</Text>
              {categoryItems.map((item) => (
                <Card key={item.id} style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
                  <Pressable
                    onPress={() => toggle.mutate({ id: item.id, is_checked: !item.is_checked })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 }}
                  >
                    <Ionicons
                      name={item.is_checked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={item.is_checked ? colors.sage : colors.textTertiary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        variant="bodyStrong"
                        style={{ textDecorationLine: item.is_checked ? 'line-through' : 'none', color: item.is_checked ? colors.textTertiary : colors.textPrimary }}
                      >
                        {item.name}
                      </Text>
                      <Text variant="caption" tone="tertiary">
                        {item.quantity} {item.unit}
                        {item.purpose ? ` · ${item.purpose}` : ''}
                      </Text>
                    </View>
                  </Pressable>
                  <Text variant="caption" tone="tertiary">
                    ${item.estimated_price.toFixed(2)}
                  </Text>
                  <IconButton name="trash-outline" size={16} onPress={() => deleteItem.mutate(item.id)} />
                </Card>
              ))}
            </View>
          ))}
        </>
      )}

      <AddItemCard />
    </View>
  );
}

function AddItemCard() {
  const addItem = useAddShoppingItem();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const onSave = async () => {
    if (!name.trim()) return;
    await addItem.mutateAsync({ name: name.trim() });
    setName('');
    setAdding(false);
  };

  return adding ? (
    <Card style={{ gap: SPACING.sm }}>
      <TextField placeholder="e.g. Greek Yogurt" value={name} onChangeText={setName} autoFocus />
      <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
        <Button label="Add" size="compact" fullWidth={false} style={{ flex: 1 }} loading={addItem.isPending} onPress={onSave} />
        <Button label="Cancel" variant="tertiary" size="compact" fullWidth={false} style={{ flex: 1 }} onPress={() => setAdding(false)} />
      </View>
    </Card>
  ) : (
    <Button label="Add Item" variant="secondary" onPress={() => setAdding(true)} />
  );
}
