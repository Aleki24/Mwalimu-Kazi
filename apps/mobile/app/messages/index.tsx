import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link, Stack } from 'expo-router';
import { formatPostedAge } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { Card, EmptyState, ErrorBanner, SchoolMark } from '../../components/ui';
import { useTeacher } from '../../lib/auth';
import { fetchThreads, type ThreadSummary } from '../../lib/messages';

export default function MessagesScreen() {
  const teacher = useTeacher();
  const insets = useSafeAreaInsets();
  const [threads, setThreads] = useState<readonly ThreadSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      setThreads(await fetchThreads(teacher.id));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your messages');
    } finally {
      setLoading(false);
    }
  }, [teacher.id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Messages' }} />
      {loading ? (
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(t) => t.thread.id}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 32 }}
          ListHeaderComponent={error !== null ? <ErrorBanner message={error} /> : null}
          ListEmptyComponent={
            <EmptyState
              title="No messages yet"
              body="A school can write to you about a role you applied for, and the thread appears here."
            />
          }
          renderItem={({ item }) => (
            <Link
              href={{ pathname: '/messages/[threadId]', params: { threadId: item.thread.id } }}
              asChild
            >
              <Pressable accessibilityRole="link">
                <Card className="flex-row items-center gap-3 p-3.5">
                  <SchoolMark name={item.counterpartName} size={38} />
                  <View className="min-w-0 flex-1">
                    <View className="flex-row items-baseline gap-2">
                      <Text
                        numberOfLines={1}
                        className="min-w-0 flex-1 text-[13px] font-medium text-foreground"
                      >
                        {item.counterpartName}
                      </Text>
                      {item.lastMessage === null ? null : (
                        <Text className="text-[10.5px] text-mutedForeground">
                          {formatPostedAge(new Date(item.lastMessage.created_at), now)}
                        </Text>
                      )}
                    </View>
                    <Text numberOfLines={1} className="text-[11.5px] text-mutedForeground">
                      {item.jobTitle}
                    </Text>
                    <Text numberOfLines={1} className="mt-0.5 text-[12px] text-foreground">
                      {item.lastMessage?.body ?? 'No messages yet'}
                    </Text>
                  </View>
                  {item.unread > 0 ? (
                    <View
                      style={{ minWidth: 18, height: 18, borderRadius: 999 }}
                      className="items-center justify-center bg-primary px-1.5"
                    >
                      <Text className="text-[10.5px] font-medium text-primaryForeground">
                        {item.unread}
                      </Text>
                    </View>
                  ) : null}
                </Card>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}
