import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Image, ScrollView, View } from 'react-native';

import { useProgressPhotos, useSettings, useUploadProgressPhoto } from '@/api/hooks';
import { API_BASE_URL } from '@/api/config';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PaywallCard } from '@/components/ui/PaywallCard';
import { Text } from '@/components/ui/Text';
import { useTheme } from '@/theme/ThemeContext';
import { RADIUS, SPACING } from '@/theme/tokens';

export function ProgressPhotosCard() {
  const { colors } = useTheme();
  const { data: settings } = useSettings();
  const { data: photos } = useProgressPhotos();
  const upload = useUploadProgressPhoto();

  if (!settings?.is_premium) {
    return (
      <PaywallCard
        title="Progress photos"
        detail="Track your physique over time, with a short AI read on posture and build for every photo you add."
      />
    );
  }

  const onAddPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const form = new FormData();
    form.append('file', {
      uri: asset.uri,
      name: asset.fileName ?? 'progress.jpg',
      type: asset.mimeType ?? 'image/jpeg',
    } as unknown as Blob);
    await upload.mutateAsync(form);
  };

  return (
    <Card style={{ gap: SPACING.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
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
          <Ionicons name="camera-outline" size={18} color={colors.accentInk} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Track your progress</Text>
          <Text variant="caption" tone="tertiary">
            Add progress photos to see your growth over time.
          </Text>
        </View>
      </View>

      {photos && photos.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SPACING.sm }}>
          {photos.slice(0, 6).map((photo) => (
            <Image
              key={photo.id}
              source={{ uri: `${API_BASE_URL}${photo.url}` }}
              style={{ width: 56, height: 72, borderRadius: RADIUS.small }}
            />
          ))}
        </ScrollView>
      )}

      <Button label="Add Photos" size="compact" variant="secondary" onPress={onAddPhotos} loading={upload.isPending} />
    </Card>
  );
}
