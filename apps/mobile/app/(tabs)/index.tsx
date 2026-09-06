import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { closingSoon, rankJobs, type JobWithSchool, type RankedJob } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { Avatar, Card, EmptyState, ErrorBanner, NoticeStrip } from '../../components/ui';
import { useTabBarClearance } from '../../components/floating-tab-bar';
import { JobCard } from '../../components/job-card';
import { fetchOpenJobs } from '../../lib/jobs';
import { useTeacher } from '../../lib/auth';

/** Routes with no tab of their own; the grid is how a teacher reaches them. */
const QUICK_ACCESS = [
  { href: '/saved', label: 'Saved jobs', icon: 'bookmark' },
  { href: '/notifications', label: 'Alerts', icon: 'bell' },
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}>;

export default function HomeScreen() {
  const tabBarClearance = useTabBarClearance();
  const insets = useSafeAreaInsets();
  const teacher = useTeacher();
  const [all, setAll] = useState<readonly JobWithSchool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // One timestamp per render pass, so "2h ago" and the ranking agree.
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const { jobs } = await fetchOpenJobs();
      setAll(jobs);
      setNow(new Date());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const ranked: readonly RankedJob[] = useMemo(
    () => rankJobs(all, teacher, now),
    [all, now],
  );
  const urgent = useMemo(() => closingSoon(all, now), [all, now]);
  const topMatches = ranked.slice(0, 3);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3 bg-card px-5 pb-4 pt-2">
        <View className="min-w-0 flex-1">
          <Text className="text-2xl font-medium tracking-tight text-foreground">
            {`Good morning, ${teacher.fullName.split(' ')[0]}`}
          </Text>
          <Text className="mt-1 text-sm text-mutedForeground">Your career dashboard</Text>
        </View>
        {/* Profile has no tab any more; this is the way in. */}
        <Avatar name={teacher.fullName} size={40} onPress={() => router.push('/profile')} label="Your profile" />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: tabBarClearance }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={colors.mutedForeground}
          />
        }
      >
        {error !== null ? <ErrorBanner message={error} /> : null}

        {urgent.length > 0 ? (
          <NoticeStrip tone="warning">
            <Text className="text-sm text-foreground">
              {urgent.length === 1 ? '1 role closes today' : `${urgent.length} roles close today`}
            </Text>
          </NoticeStrip>
        ) : null}

        <Card className="p-3.5">
          <Text className="text-[13px] font-medium text-foreground">Auto-Apply is off</Text>
          <Text className="mt-1 text-[11.5px] leading-4 text-mutedForeground">
            Set your rules and we will apply to strong matches for you, before the shortlist fills.
          </Text>
        </Card>

        <View className="flex-row flex-wrap gap-2.5">
          {QUICK_ACCESS.map((item) => (
            <Link key={item.href} href={item.href} asChild>
              <Pressable accessibilityRole="button" style={{ width: '48.5%' }}>
                <Card className="items-center gap-1.5 px-2 py-3">
                  <Feather name={item.icon} size={19} color={colors.foreground} />
                  <Text className="text-[11.5px] font-medium text-foreground">{item.label}</Text>
                </Card>
              </Pressable>
            </Link>
          ))}
        </View>

        <View className="flex-row items-baseline justify-between">
          <Text className="text-[15px] font-medium tracking-tight text-foreground">Top matches for you</Text>
          <Link href="/(tabs)/jobs" className="text-xs font-medium text-foreground">See all</Link>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.mutedForeground} className="py-8" />
        ) : topMatches.length === 0 ? (
          <EmptyState title="No open roles yet" body="New vacancies will appear here as schools post them." />
        ) : (
          topMatches.map((entry) => <JobCard key={entry.job.id} entry={entry} now={now} />)
        )}
      </ScrollView>
    </View>
  );
}
