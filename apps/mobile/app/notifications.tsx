import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, SectionList, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { formatPostedAge, matchBand, matchScore, type JobWithSchool } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import type { Tables } from '@mwalimu/types';
import { Card, centredContent, EmptyState, ErrorBanner } from '../components/ui';
import { fetchNotifications, jobIdOf, markAllRead, threadIdOf } from '../lib/notifications';
import { useTeacher } from '../lib/auth';
import { playNotificationSound } from '../lib/sound';

type Kind = Tables<'notifications'>['kind'];

/**
 * Tone per kind. A rejection and a match should not look alike — the whole
 * point of typed notifications is that the list is scannable without reading.
 */
const TONE: Readonly<Record<Kind, { fg: string; mark: string }>> = {
  job_match:           { fg: 'text-foreground', mark: '★' },
  auto_apply_sent:     { fg: 'text-successForeground', mark: '⚡' },
  auto_apply_failed:   { fg: 'text-destructiveForeground', mark: '!' },
  application_viewed:  { fg: 'text-infoForeground', mark: '◉' },
  shortlisted:         { fg: 'text-warningForeground', mark: '★' },
  rejected:            { fg: 'text-mutedForeground', mark: '—' },
  interview_invite:    { fg: 'text-warningForeground', mark: '◷' },
  profile_viewed:      { fg: 'text-infoForeground', mark: '◉' },
  school_review:       { fg: 'text-destructiveForeground', mark: '⚑' },
  followed_school_job: { fg: 'text-foreground', mark: '◆' },
  news:                { fg: 'text-infoForeground', mark: '▤' },
  resource:            { fg: 'text-foreground', mark: '▤' },
  message:             { fg: 'text-foreground', mark: '✉' },
};

const DAY_MS = 24 * 60 * 60 * 1000;

const SCORE_COLOUR = {
  strong: 'text-successForeground',
  good: 'text-foreground',
  partial: 'text-warningForeground',
  weak: 'text-mutedForeground',
} as const;

export default function NotificationsScreen() {
  const teacher = useTeacher();
  const [items, setItems] = useState<readonly Tables<'notifications'>[]>([]);
  const [jobs, setJobs] = useState<ReadonlyMap<string, JobWithSchool>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const feed = await fetchNotifications();
      // Sound only for rows that are new SINCE THE LAST LOAD. Playing it for
      // every unread row would chime on every visit to a screen someone has
      // already read, which is how a tone stops meaning "something happened".
      setItems((prev) => {
        const known = new Set(prev.map((n) => n.id));
        const arrived = feed.items.filter((n) => !known.has(n.id) && n.read_at === null);
        if (prev.length > 0 && arrived.length > 0) void playNotificationSound(teacher.notificationSound);
        return feed.items;
      });
      setJobs(feed.jobs);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, [teacher.notificationSound]);

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
              <Text className="text-[12.5px] font-medium text-foreground">Mark all read</Text>
            </Pressable>
          ),
        }}
      />

      {loading ? (
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
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
          contentContainerStyle={{
            paddingHorizontal: 16, paddingBottom: 32, ...centredContent,
          }}
          renderSectionHeader={({ section }) => (
            <Text className="bg-background pb-1.5 pt-3 text-[11px] font-medium uppercase tracking-wider text-mutedForeground">
              {section.title}
            </Text>
          )}
          renderItem={({ item }) => {
            const tone = TONE[item.kind];
            const unread = item.read_at === null;
            // Scored here, not at insert: the number tracks the teacher's
            // current profile rather than whatever it was when the job posted.
            const jobId = jobIdOf(item);
            const entry = jobId === null ? undefined : jobs.get(jobId);
            const match = entry === undefined ? null : matchScore(entry.job, teacher).score;
            // Unread is a card lift plus a dot, never a tinted fill. An
            // opacity modifier on a token that is already an ink mix
            // (`bg-wash/40`) rewrites its alpha to 0.4 rather than scaling it,
            // which painted the whole row 40% ink.
            const row = (
              // Unread is a card lift, read is flat on the canvas — the same
              // distinction the rest of the app draws, instead of a divider list.
              <Card
                className={`mb-2 flex-row gap-3 p-3 ${unread ? '' : 'bg-transparent'}`}
                style={unread ? undefined : { shadowOpacity: 0, elevation: 0 }}
              >
                <View className="h-[34px] w-[34px] items-center justify-center rounded-full bg-wash">
                  <Text className={`text-[13px] ${tone.fg}`}>{tone.mark}</Text>
                </View>
                <View className="min-w-0 flex-1">
                  <View className="flex-row items-baseline gap-2">
                    <Text className="min-w-0 flex-1 text-[12.5px] font-medium text-foreground">{item.title}</Text>
                    <Text className="text-[10.5px] text-mutedForeground">
                      {formatPostedAge(new Date(item.created_at), now)}
                    </Text>
                    {unread ? <View className="h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                  </View>
                  <Text className="mt-0.5 text-[11.5px] leading-4 text-mutedForeground">{item.body}</Text>
                  {match === null ? null : (
                    <Text className={`mt-1 text-[11px] ${SCORE_COLOUR[matchBand(match)]}`}>
                      {match}% match for you
                    </Text>
                  )}
                </View>
              </Card>
            );

            // Telling someone about a vacancy — or that a school has written
            // to them — and then making them go and find it is the whole
            // feature failing at the last step.
            const threadId = threadIdOf(item);
            const href =
              jobId !== null ? { pathname: '/job/[id]' as const, params: { id: jobId } }
              : threadId !== null ? { pathname: '/messages/[threadId]' as const, params: { threadId } }
              : null;
            if (href === null) return row;
            return (
              <Link href={href} asChild>
                <Pressable accessibilityRole="link">{row}</Pressable>
              </Link>
            );
          }}
        />
      )}
    </View>
  );
}
