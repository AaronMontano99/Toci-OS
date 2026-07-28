import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useShopping, useToggleShoppingItem } from '@/api/hooks';
import { ShoppingItem } from '@/api/types';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Text } from '@/components/ui/Text';
import { titleCase } from '@/lib/format';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

export function CartPanel() {
  const { colors } = useTheme();
  const { data } = useShopping();
  const toggle = useToggleShoppingItem();

  const items: ShoppingItem[] = data?.items ?? [];
  if (items.length === 0) {
    return <EmptyState title="Your cart is empty" detail="Add ingredients from a recipe to build your shopping list." />;
  }

  const byCategory = items.reduce<Record<string, ShoppingItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  const total = items.reduce((sum, i) => sum + i.estimated_price, 0);

  return (
    <View style={{ gap: SPACING.base }}>
      <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="bodyStrong">Estimated total</Text>
        <Text variant="bodyStrong">${total.toFixed(2)}</Text>
      </Card>

      {Object.entries(byCategory).map(([category, categoryItems]) => (
        <View key={category} style={{ gap: SPACING.sm }}>
          <Text variant="sectionTitle">{titleCase(category)}</Text>
          {categoryItems.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => toggle.mutate({ id: item.id, is_checked: !item.is_checked })}
            >
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
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
                <Text variant="caption" tone="tertiary">
                  ${item.estimated_price.toFixed(2)}
                </Text>
              </Card>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
