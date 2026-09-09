import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { formatPostedAge } from '@mwalimu/core';
import { colors, radius } from '@mwalimu/ui';
import { centredContent, ErrorBanner } from '../../components/ui';
import { useTeacher } from '../../lib/auth';
import {
  fetchThread, markThreadRead, sendMessage,
  type Conversation, type ThreadMessage,
} from '../../lib/messages';

export default function ThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const teacher = useTeacher();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ThreadMessage>>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const next = await fetchThread(threadId, teacher.id);
      setConversation(next);
      setError(null);
      // Read receipts are a side effect of opening the thread, not something
      // to make the reader do.
      if (next.messages.some((m) => !m.mine && m.message.read_at === null)) {
        await markThreadRead(threadId, teacher.id);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load this conversation');
    } finally {
      setLoading(false);
    }
  }, [threadId, teacher.id]);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    const body = draft.trim();
    if (body === '' || sending) return;
    setSending(true);
    try {
      await sendMessage(threadId, teacher.id, body);
      // Cleared only once it has landed, so a failure does not eat what
      // someone just wrote.
      setDraft('');
      await load();
      listRef.current?.scrollToEnd({ animated: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send that');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Named for whoever is on the other end, so a crowded inbox is legible. */}
      <Stack.Screen options={{ title: conversation?.summary.counterpartName ?? 'Conversation' }} />
      {loading ? (
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      ) : (
        <FlatList
          ref={listRef}
          data={conversation?.messages ?? []}
          keyExtractor={(m) => m.message.id}
          contentContainerStyle={{ padding: 16, gap: 8, ...centredContent }}
          ListHeaderComponent={
            <View className="gap-2">
              {error !== null ? <ErrorBanner message={error} /> : null}
              {conversation === null ? null : (
                <Text className="pb-1 text-center text-[11.5px] text-mutedForeground">
                  About {conversation.summary.jobTitle}
                </Text>
              )}
            </View>
          }
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => (
            <View className={item.mine ? 'items-end' : 'items-start'}>
              <View
                style={{ borderRadius: radius.xl2, borderCurve: 'continuous', maxWidth: '86%' }}
                className={`px-3.5 py-2.5 ${
                  item.mine ? 'bg-primary' : 'border border-border bg-card'
                }`}
              >
                <Text
                  className={`text-[13.5px] leading-5 ${
                    item.mine ? 'text-primaryForeground' : 'text-foreground'
                  }`}
                >
                  {item.message.body}
                </Text>
              </View>
              <Text className="mt-1 px-1 text-[10.5px] text-mutedForeground">
                {item.mine ? 'You' : item.senderName} ·{' '}
                {formatPostedAge(new Date(item.message.created_at), now)}
              </Text>
            </View>
          )}
        />
      )}

      <View
        className="flex-row items-end gap-2 border-t border-border bg-card px-3 pt-2.5"
        style={{ paddingBottom: Math.max(insets.bottom, 10) }}
      >
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a message…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={4000}
          className="min-h-[42px] max-h-[120px] flex-1 rounded-md border border-border bg-background px-3 py-2.5 text-[13.5px] text-foreground"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          disabled={draft.trim() === '' || sending}
          onPress={() => void submit()}
          style={{ borderRadius: radius.md, borderCurve: 'continuous' }}
          className={`h-[42px] w-[42px] items-center justify-center ${
            draft.trim() === '' || sending ? 'bg-wash' : 'bg-primary'
          }`}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          ) : (
            <Feather
              name="arrow-up"
              size={17}
              color={draft.trim() === '' ? colors.mutedForeground : colors.primaryForeground}
            />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
