import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { formatPostedAge, formatLabel } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import type { Tables } from '@mwalimu/types';
import {
  Card, centredContent, Chip, EmptyState, ErrorBanner, ScreenHeader,
} from '../../components/ui';
import { useTabBarClearance } from '../../components/floating-tab-bar';
import { fetchNews } from '../../lib/content';

type Topic = Tables<'news_articles'>['topic'];

/**
 * An icon per topic, instead of the empty grey rectangle every row used to
 * carry. `image_url` is null on every article, so that box was a broken image
 * in all but name — and a glyph that says which institution is speaking is
 * more use than a photograph would have been anyway.
 */
const TOPIC_ICON: Readonly<Record<Topic, React.ComponentProps<typeof Feather>['name']>> = {
  tsc: 'user-check',
  knec: 'clipboard',
  kicd: 'book-open',
  cbc: 'layers',
  policy: 'file-text',
  recruitment: 'briefcase',
  scholarships: 'award',
  professional_development: 'trending-up',
};

/** Chips for the topics that have something in them — see resources.tsx. */
function topicChips(
  items: readonly Tables<'news_articles'>[],
): ReadonlyArray<{ key: Topic | 'all'; label: string }> {
  const present = [...new Set(items.map((a) => a.topic))].sort();
  return [
    { key: 'all' as const, label: 'All' },
    ...present.map((t) => ({ key: t, label: formatLabel(t) })),
  ];
}

function TopicMark({ topic, size }: { topic: Topic; size: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: 12, borderCurve: 'continuous' }}
      className="items-center justify-center bg-primarySurface"
    >
      <Feather name={TOPIC_ICON[topic]} size={size <= 52 ? 18 : 24} color={colors.primary} />
    </View>
  );
}

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
  const chips = useMemo(() => topicChips(items), [items]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScreenHeader
        title="News"
        subtitle={loading ? 'Loading…' : `${items.length} updates`}
      />
      <View className="bg-card px-5 pb-3">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {chips.map((t) => (
            <Chip key={t.key} label={t.label} selected={topic === t.key} onPress={() => setTopic(t.key)} />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      ) : (
        <FlatList
          data={rest}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{
            padding: 16, gap: 10, paddingBottom: tabBarClearance, ...centredContent,
          }}
          ListHeaderComponent={
            <View className="gap-3">
              {error !== null ? <ErrorBanner message={error} /> : null}
              {featured !== undefined ? (
                <Link href={{ pathname: '/news/[id]', params: { id: featured.id } }} asChild>
                  <Pressable accessibilityRole="link">
                <Card className="mb-1 p-0">
                  <View className="flex-row items-center gap-3 px-3.5 pt-3.5">
                    <TopicMark topic={featured.topic} size={56} />
                    <Text className="flex-1 text-[11px] leading-4 text-mutedForeground">
                      {featured.summary === null ? formatLabel(featured.topic) : 'Latest'}
                    </Text>
                  </View>
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
                    <View className="mt-2 flex-row items-center gap-1.5">
                      <Text className="text-[11.5px] font-medium text-primary">Read this update</Text>
                      <Feather name="chevron-right" size={13} color={colors.primary} />
                    </View>
                  </View>
                </Card>
                  </Pressable>
                </Link>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            featured === undefined
              ? (
                <EmptyState
                  title="No updates yet"
                  body="Nothing has been published here. When it is, it will name its source and link to it, so you can check it before you act on it."
                />
              )
              : null
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: '/news/[id]', params: { id: item.id } }} asChild>
              <Pressable accessibilityRole="link">
                <Card className="flex-row items-start gap-3 p-3">
                  <TopicMark topic={item.topic} size={52} />
                  <View className="min-w-0 flex-1">
                    <Text className="text-[10.5px] font-medium uppercase tracking-wide text-mutedForeground">
                      {item.source}
                    </Text>
                    <Text className="mt-0.5 text-[12.5px] font-medium leading-4 text-foreground">
                      {item.title}
                    </Text>
                    <Text className="mt-1 text-[10.5px] text-mutedForeground">
                      {formatPostedAge(new Date(item.published_at), now)}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
                </Card>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}
