import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View } from 'react-native';

import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';

interface ScreenHeaderProps {
  title?: string;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
  showDot?: boolean;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, rightIcon, onRightPress, showDot, right }: ScreenHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {title ? <Text variant="screenTitle">{title}</Text> : <View />}

      {right ?? (
        rightIcon && (
          <View>
            <IconButton name={rightIcon} onPress={onRightPress} background />
            {showDot && (
              <View
                style={{
                  position: 'absolute',
                  top: 6,
                  right: 6,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: colors.accent,
                  borderWidth: 1,
                  borderColor: colors.card,
                }}
              />
            )}
          </View>
        )
      )}
    </View>
  );
}
