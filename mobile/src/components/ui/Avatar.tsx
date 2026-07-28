import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';

interface AvatarProps {
  name: string;
  size?: number;
  editable?: boolean;
  onEdit?: () => void;
}

export function Avatar({ name, size = 44, editable, onEdit }: AvatarProps) {
  const { colors } = useTheme();
  const initial = name.trim().charAt(0).toUpperCase() || 'T';

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.accentWash,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: colors.accentInk, fontSize: size * 0.4, fontFamily: 'Manrope_700Bold' }}>
          {initial}
        </Text>
      </View>
      {editable && (
        <Pressable
          onPress={onEdit}
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: size * 0.34,
            height: size * 0.34,
            borderRadius: (size * 0.34) / 2,
            backgroundColor: colors.accent,
            borderWidth: 2,
            borderColor: colors.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          hitSlop={6}
        >
          <Ionicons name="pencil" size={size * 0.16} color={colors.onAccent} />
        </Pressable>
      )}
    </View>
  );
}
