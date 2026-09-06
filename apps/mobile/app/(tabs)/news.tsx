import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatPostedAge, formatLabel } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import type { Tables } from '@mwalimu/types';
import { Card, Chip, EmptyState, ErrorBanner, ScreenHeader } from '../../components/ui';
import { useTabBarClearance } from '../../components/floating-tab-bar';
import { fetchNews } from '../../lib/content';

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
  const tabBarClearance = useTabBarClearance();
  const insets = useSafeAreaInsets();
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
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScreenHeader
        title="News"
        subtitle={loading ? 'Loading…' : `${items.length} updates`}
      />
      <View className="bg-card px-5 pb-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TOPICS.map((t) => (
            <Pressable key={t.key} onPress={() => setTopic(t.key)} accessibilityRole="button">
              <Chip label={t.label} selected={topic === t.key} />
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      ) : (
        <FlatList
          data={rest}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: 16, paddingBottom: tabBarClearance }}
          ListHeaderComponent={
            <View className="gap-3">
              {error !== null ? <ErrorBanner message={error} /> : null}
              {featured !== undefined ? (
                <Card className="mb-1 p-0">
                  <View className="h-24 rounded-t-2xl bg-secondary" />
                  <View className="p-3.5">
                    {/* A label, not a control — Chip is 44px and tappable. */}
                    <View className="flex-row items-center gap-2">
                      <Text className="text-[10.5px] uppercase tracking-wide text-mutedForeground">
                        {featured.source}
                      </Text>
                      <Text className="text-[10.5px] text-mutedForeground">·</Text>
                      <Text className="text-[10.5px] text-mutedForeground">
                        {formatPostedAge(new Date(featured.published_at), now)}
                      </Text>
                    </View>
                    <Text className="mt-2 text-[15px] font-medium leading-5 tracking-tight text-foreground">
                      {featured.title}
                    </Text>
                    {featured.summary !== null ? (
                      <Text className="mt-1.5 text-[11.5px] leading-4 text-mutedForeground">{featured.summary}</Text>
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
              <View className="h-[52px] w-[52px] rounded-lg bg-secondary" />
              <View className="min-w-0 flex-1">
                <Text className="text-[10.5px] font-medium uppercase tracking-wide text-foreground">
                  {item.source}
                </Text>
                <Text className="mt-0.5 text-[12.5px] font-medium leading-4 text-foreground">
                  {item.title}
                </Text>
                <Text className="mt-1 text-[10.5px] text-mutedForeground">
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
