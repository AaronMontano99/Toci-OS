import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Switch, View } from 'react-native';

import { api } from '@/api/client';
import { useSettings, useUpdateSettings } from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';
import { useMutation } from '@tanstack/react-query';

export default function AccountScreen() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const updatePassword = useMutation({
    mutationFn: () => api.post('/api/settings/password', { new_password: newPassword, confirm_password: confirmPassword }),
    onSuccess: () => {
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password updated');
    },
    onError: (e: Error) => Alert.alert("Couldn't update password", e.message),
  });

  return (
    <ScreenContainer>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACING.sm }}>
        <IconButton name="chevron-back" onPress={() => router.back()} />
        <Text variant="screenTitle">Account</Text>
      </View>

      <Card style={{ gap: SPACING.sm }}>
        <Text variant="cardTitle">Name</Text>
        <TextField value={settings?.name ?? ''} onChangeText={(v) => update.mutate({ name: v })} />
      </Card>

      <Card style={{ gap: SPACING.md }}>
        <Text variant="cardTitle">Notifications</Text>
        <Row
          label="Daily recommendation"
          value={settings?.notif_daily_recommendation ?? true}
          onChange={(v) => update.mutate({ notif_daily_recommendation: v })}
        />
        <Row
          label="Readiness alerts"
          value={settings?.notif_readiness_alerts ?? true}
          onChange={(v) => update.mutate({ notif_readiness_alerts: v })}
        />
      </Card>

      <Card style={{ gap: SPACING.sm }}>
        <Text variant="cardTitle">Change password</Text>
        <TextField placeholder="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} />
        <TextField placeholder="Confirm password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} />
        <Button
          label="Update password"
          size="compact"
          loading={updatePassword.isPending}
          onPress={() => updatePassword.mutate()}
        />
      </Card>

      <Text variant="caption" tone="tertiary">
        This is a single-user local demo — there&rsquo;s no sign-in flow yet, so &ldquo;Sign out&rdquo; and multi-account
        features aren&rsquo;t wired up (see app/README.md&rsquo;s known gaps).
      </Text>
    </ScreenContainer>
  );
}

function Row({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text variant="body">{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.accent, false: colors.border }} />
    </View>
  );
}
