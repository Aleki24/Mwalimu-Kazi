import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { formatLabel, formatPostedAge } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import type { Tables } from '@mwalimu/types';
import { Card, centredContent, ErrorBanner, NoticeStrip, Tag } from '../../components/ui';
import { fetchArticle } from '../../lib/content';

/**
 * An article, read in the app.
 *
 * The feed used to be entirely inert — no detail route, no Pressable, and
 * `body` and `url` unread on every row. A headline about TSC that a teacher
 * cannot open or check is not information, it is a rumour with a timestamp,
 * which is why the source link is given its own place here rather than being
 * left implicit.
 */
export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [article, setArticle] = useState<Tables<'news_articles'> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchArticle(id);
        if (!cancelled) setArticle(next);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load that update');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      </View>
    );
  }

  if (article === null) {
    return (
      <View className="flex-1 bg-background p-4">
        <Stack.Screen options={{ title: 'Update' }} />
        <ErrorBanner message={error ?? 'That update is no longer here.'} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: formatLabel(article.topic) }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, ...centredContent }}>
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <Tag label={formatLabel(article.topic)} />
            <Text className="text-[11px] text-mutedForeground">
              {formatPostedAge(new Date(article.published_at), now)}
            </Text>
          </View>
          <Text className="text-[20px] font-medium leading-7 tracking-tight text-foreground">
            {article.title}
          </Text>
          <Text className="text-[11.5px] uppercase tracking-wide text-mutedForeground">
            {article.source}
          </Text>
        </View>

        {article.summary === null ? null : (
          <Text className="text-[14px] leading-6 text-foreground">{article.summary}</Text>
        )}

        {article.body === null ? null : (
          <Card className="p-3.5">
            <Text className="text-[13.5px] leading-6 text-foreground">{article.body}</Text>
          </Card>
        )}

        {/*
          Where the claim can be checked, or an admission that it cannot be.
          Saying so is the difference between a summary and a citation, and the
          reader is the one who bears the cost of the difference.
        */}
        {article.url === null ? (
          <NoticeStrip>
            No source link was published with this update. Check it against the
            institution’s own notice before acting on it.
          </NoticeStrip>
        ) : (
          <Pressable
            accessibilityRole="link"
            onPress={() => void Linking.openURL(article.url ?? '')}
            className="flex-row items-center gap-2 py-2"
          >
            <Feather name="external-link" size={14} color={colors.primary} />
            <Text className="text-[13px] font-medium text-primary">Read at source</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
