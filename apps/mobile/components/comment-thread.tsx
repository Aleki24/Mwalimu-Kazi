import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { formatPostedAge } from '@mwalimu/core';
import { colors, radius } from '@mwalimu/ui';
import Feather from '@expo/vector-icons/Feather';
import type { Comment } from '../lib/social';
import { ErrorBanner } from './ui';

/**
 * A comment thread, shared by jobs and posts.
 *
 * The two differ only in which table they read, so they take the same
 * component rather than growing two that drift. Comments are attributed here —
 * unlike reviews, which are anonymous by design.
 */
export function CommentThread({
  load, send, emptyHint,
}: {
  load: () => Promise<readonly Comment[]>;
  send: (body: string) => Promise<void>;
  emptyHint: string;
}) {
  const [comments, setComments] = useState<readonly Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const refresh = useCallback(async () => {
    try {
      setComments(await load());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load comments');
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => { void refresh(); }, [refresh]);

  const submit = async () => {
    const body = draft.trim();
    if (body === '' || sending) return;
    setSending(true);
    try {
      await send(body);
      // Cleared only after the write lands, so a failure does not eat what
      // someone just typed.
      setDraft('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not post your comment');
    } finally {
      setSending(false);
    }
  };

  return (
    <View className="gap-2.5">
      <Text className="text-[12.5px] font-medium text-foreground">
        {comments.length === 0 ? 'Comments' : `Comments (${comments.length})`}
      </Text>

      {error !== null ? <ErrorBanner message={error} /> : null}

      {loading ? (
        <ActivityIndicator color={colors.mutedForeground} className="py-3" />
      ) : comments.length === 0 ? (
        <Text className="text-[11.5px] leading-4 text-mutedForeground">{emptyHint}</Text>
      ) : (
        <View className="gap-2.5">
          {comments.map((c) => (
            <View key={c.id} className="gap-0.5">
              <View className="flex-row items-baseline gap-2">
                <Text className="text-[12px] font-medium text-foreground">
                  {c.author?.fullName ?? 'Former member'}
                </Text>
                <Text className="text-[10.5px] text-mutedForeground">
                  {formatPostedAge(c.createdAt, now)}
                </Text>
              </View>
              {c.author?.headline == null ? null : (
                <Text className="text-[10.5px] text-mutedForeground">{c.author.headline}</Text>
              )}
              <Text className="text-[12.5px] leading-5 text-foreground">{c.body}</Text>
            </View>
          ))}
        </View>
      )}

      <View className="flex-row items-end gap-2">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask something…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={2000}
          className="min-h-[42px] flex-1 rounded-md border border-border bg-card px-3 py-2.5 text-[13.5px] text-foreground"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Post comment"
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
    </View>
  );
}
