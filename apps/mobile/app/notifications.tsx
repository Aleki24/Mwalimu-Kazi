import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, SectionList, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { formatPostedAge } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import type { Tables } from '@mwalimu/types';
import { EmptyState, ErrorBanner } from '../components/ui';
import { fetchNotifications, markAllRead } from '../lib/notifications';

type Kind = Tables<'notifications'>['kind'];

/**
 * Tone per kind. A rejection and a match should not look alike — the whole
 * point of typed notifications is that the list is scannable without reading.
 */
const TONE: Readonly<Record<Kind, { bg: string; fg: string; mark: string }>> = {
  job_match:           { bg: 'bg-primarySoft', fg: 'text-primary', mark: '★' },
  auto_apply_sent:     { bg: 'bg-successBg', fg: 'text-success', mark: '⚡' },
  auto_apply_failed:   { bg: 'bg-dangerBg', fg: 'text-danger', mark: '!' },
  application_viewed:  { bg: 'bg-infoBg', fg: 'text-info', mark: '◉' },
  shortlisted:         { bg: 'bg-warningBg', fg: 'text-warning', mark: '★' },
  rejected:            { bg: 'bg-mutedBg', fg: 'text-muted', mark: '—' },
  interview_invite:    { bg: 'bg-warningBg', fg: 'text-warning', mark: '◷' },
  profile_viewed:      { bg: 'bg-infoBg', fg: 'text-info', mark: '◉' },
  school_review:       { bg: 'bg-dangerBg', fg: 'text-danger', mark: '⚑' },
  followed_school_job: { bg: 'bg-primarySoft', fg: 'text-primary', mark: '◆' },
  news:                { bg: 'bg-infoBg', fg: 'text-info', mark: '▤' },
  resource:            { bg: 'bg-primarySoft', fg: 'text-primary', mark: '▤' },
};

const DAY_MS = 24 * 60 * 60 * 1000;

export default function NotificationsScreen() {
  const [items, setItems] = useState<readonly Tables<'notifications'>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      setItems(await fetchNotifications());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sections = useMemo(() => {
    const today: Tables<'notifications'>[] = [];
    const earlier: Tables<'notifications'>[] = [];
    for (const n of items) {
      (now.getTime() - new Date(n.created_at).getTime() < DAY_MS ? today : earlier).push(n);
    }
    return [
      { title: 'Today', data: today },
      { title: 'Earlier', data: earlier },
    ].filter((s) => s.data.length > 0);
  }, [items, now]);

  const onMarkAllRead = async () => {
    try {
      await markAllRead();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not mark as read');
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerRight: () => (
            <Pressable accessibilityRole="button" onPress={() => void onMarkAllRead()} className="h-11 justify-center px-2">
              <Text className="text-[12.5px] font-semibold text-primary">Mark all read</Text>
            </Pressable>
          ),
        }}
      />

      {loading ? (
        <ActivityIndicator color={colors.primary} className="py-10" />
      ) : items.length === 0 ? (
        <View>
          {error !== null ? <View className="p-4"><ErrorBanner message={error} /></View> : null}
          <EmptyState
            title="Nothing yet"
            body="Job matches, application updates and school alerts will arrive here."
          />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderSectionHeader={({ section }) => (
            <Text className="bg-background px-4 pb-1.5 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => {
            const tone = TONE[item.kind];
            const unread = item.read_at === null;
            return (
              <View className={`flex-row gap-3 border-b border-border px-4 py-3 ${unread ? 'bg-primarySoft/40' : ''}`}>
                <View className={`h-[34px] w-[34px] items-center justify-center rounded-full ${tone.bg}`}>
                  <Text className={`text-[13px] font-bold ${tone.fg}`}>{tone.mark}</Text>
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-baseline gap-2">
                    <Text className="min-w-0 flex-1 text-[12.5px] font-bold text-foreground">{item.title}</Text>
                    <Text className="text-[10.5px] text-mutedFaint">
                      {formatPostedAge(new Date(item.created_at), now)}
                    </Text>
                  </View>
                  <Text className="mt-0.5 text-[11.5px] leading-4 text-muted">{item.body}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
