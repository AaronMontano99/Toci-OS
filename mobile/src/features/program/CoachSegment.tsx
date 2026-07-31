import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import {
  useApplyChatProposal,
  useChatHistory,
  useDiscardChatProposal,
  useSendChatMessage,
  useSettings,
  useUpdateSettings,
} from '@/api/hooks';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { InsightCard } from '@/components/ui/InsightCard';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { useTheme } from '@/theme/ThemeContext';
import { SPACING } from '@/theme/tokens';

export function CoachSegment({ observations }: { observations: string[] }) {
  const { colors } = useTheme();
  const { data: messages } = useChatHistory();
  const sendMessage = useSendChatMessage();
  const applyProposal = useApplyChatProposal();
  const discardProposal = useDiscardChatProposal();
  const [draft, setDraft] = useState('');

  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const coachName = settings?.coach_name || 'Toci';
  const [coachNameDraft, setCoachNameDraft] = useState('');

  useEffect(() => {
    if (settings?.coach_name) setCoachNameDraft(settings.coach_name);
  }, [settings?.coach_name]);

  const onSend = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    await sendMessage.mutateAsync(text);
  };

  const onSaveCoachName = () => {
    const name = coachNameDraft.trim();
    if (!name || name === settings?.coach_name) return;
    updateSettings.mutate({ coach_name: name });
  };

  return (
    <View style={{ gap: SPACING.lg }}>
      {observations.length > 0 && (
        <View style={{ gap: SPACING.sm }}>
          <Text variant="sectionTitle">Observations</Text>
          {observations.map((line, i) => (
            <InsightCard key={i} tone="accent" icon="💡" text={line} />
          ))}
        </View>
      )}

      <View style={{ gap: SPACING.sm }}>
        <Text variant="sectionTitle">Ask {coachName}</Text>
        <Text variant="caption" tone="tertiary">
          Scoped to your own program, goals, and history — ask about your schedule, exercises, or request a change.
        </Text>

        {!messages?.length && (
          <EmptyState title="Ask about your program" detail={'Try "What are my warm-up movements?" or "Can I replace this exercise?"'} />
        )}

        <View style={{ gap: SPACING.sm }}>
          {messages?.map((m) => (
            <View
              key={m.id}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                backgroundColor: m.role === 'user' ? colors.accentWash : colors.card,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border,
                padding: SPACING.sm,
              }}
            >
              <Text variant="body" style={m.role === 'user' ? { color: colors.accentInk } : undefined}>
                {m.content}
              </Text>
              {m.proposal && m.proposal_status === 'pending' && (
                <View style={{ marginTop: SPACING.sm, gap: SPACING.xs }}>
                  <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                    <Button
                      label="Apply"
                      size="compact"
                      fullWidth={false}
                      style={{ flex: 1 }}
                      onPress={() => applyProposal.mutate(m.id)}
                      loading={applyProposal.isPending}
                    />
                    <Button
                      label="Discard"
                      variant="tertiary"
                      size="compact"
                      fullWidth={false}
                      style={{ flex: 1 }}
                      onPress={() => discardProposal.mutate(m.id)}
                    />
                  </View>
                </View>
              )}
              {m.proposal_status === 'applied' && (
                <Text variant="caption" style={{ color: colors.sage, marginTop: 4, fontWeight: '700' }}>
                  Applied
                </Text>
              )}
              {m.proposal_status === 'discarded' && (
                <Text variant="caption" tone="tertiary" style={{ marginTop: 4 }}>
                  Discarded
                </Text>
              )}
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-end' }}>
          <TextField
            placeholder={`Ask ${coachName}…`}
            value={draft}
            onChangeText={setDraft}
            style={{ flex: 1 }}
            multiline
            onSubmitEditing={onSend}
          />
          <Button label="Send" fullWidth={false} size="compact" onPress={onSend} loading={sendMessage.isPending} />
        </View>
      </View>

      <Card style={{ gap: SPACING.sm }}>
        <Text variant="sectionTitle">Customize your coach&rsquo;s name</Text>
        <View style={{ flexDirection: 'row', gap: SPACING.sm, alignItems: 'flex-end' }}>
          <TextField
            placeholder="Toci"
            value={coachNameDraft}
            onChangeText={setCoachNameDraft}
            style={{ flex: 1 }}
            onSubmitEditing={onSaveCoachName}
          />
          <Button
            label="Save"
            fullWidth={false}
            size="compact"
            onPress={onSaveCoachName}
            loading={updateSettings.isPending}
          />
        </View>
      </Card>
    </View>
  );
}
