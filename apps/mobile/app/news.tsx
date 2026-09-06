import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { formatPostedAge, formatLabel } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import type { Tables } from '@mwalimu/types';
import { Card, Chip, EmptyState, ErrorBanner } from '../components/ui';
import { fetchNews } from '../lib/content';

type Topic = Tables<'news_articles'>['topic'];

const TOPICS: ReadonlyArray<{ key: Topic | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'tsc', label: 'TSC' },
  { key: 'knec', label: 'KNEC' },
  { key: 'kicd', label: 'KICD' },
  { key: 'cbc', label: 'CBC' },
  { key: 'recruitment', label: 'Recruitment' },
  { key: 'scholarships', label: 'Scholarships' },
];

export default function NewsScreen() {
  const [items, setItems] = useState<readonly Tables<'news_articles'>[]>([]);
  const [topic, setTopic] = useState<Topic | 'all'>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      setItems(await fetchNews());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load news');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(
    () => (topic === 'all' ? items : items.filter((a) => a.topic === topic)),
    [items, topic],
  );
  const [featured, ...rest] = visible;

  return (
    <View className="flex-1 bg-background">
      <View className="border-b border-border bg-card px-4 pb-3 pt-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TOPICS.map((t) => (
            <Pressable key={t.key} onPress={() => setTopic(t.key)} accessibilityRole="button">
              <Chip label={t.label} selected={topic === t.key} />
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} className="py-10" />
      ) : (
        <FlatList
          data={rest}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListHeaderComponent={
            <View className="gap-3">
              {error !== null ? <ErrorBanner message={error} /> : null}
              {featured !== undefined ? (
                <Card className="mb-1 p-0">
                  <View className="h-24 rounded-t-lg bg-primaryDark" />
                  <View className="p-3.5">
                    <View className="flex-row items-center gap-2">
                      <Chip label={formatLabel(featured.topic)} selected />
                      <Text className="text-[10.5px] text-muted">
                        {formatPostedAge(new Date(featured.published_at), now)}
                      </Text>
                    </View>
                    <Text className="mt-2 text-[15px] font-bold leading-5 tracking-tight text-foreground">
                      {featured.title}
                    </Text>
                    {featured.summary !== null ? (
                      <Text className="mt-1.5 text-[11.5px] leading-4 text-muted">{featured.summary}</Text>
                    ) : null}
                  </View>
                </Card>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            featured === undefined
              ? <EmptyState title="No updates yet" body="Education news will appear here." />
              : null
          }
          renderItem={({ item }) => (
            <View className="flex-row items-start gap-3 border-b border-border py-3">
              <View className="h-[52px] w-[52px] rounded-md bg-primarySoft" />
              <View className="min-w-0 flex-1">
                <Text className="text-[10.5px] font-bold uppercase tracking-wide text-primary">
                  {item.source}
                </Text>
                <Text className="mt-0.5 text-[12.5px] font-semibold leading-4 text-foreground">
                  {item.title}
                </Text>
                <Text className="mt-1 text-[10.5px] text-muted">
                  {formatPostedAge(new Date(item.published_at), now)}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
