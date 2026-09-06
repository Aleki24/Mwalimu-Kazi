import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { closingSoon, rankJobs, type JobWithSchool, type RankedJob } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { Card, EmptyState, ErrorBanner, ScreenHeader } from '../../components/ui';
import { JobCard } from '../../components/job-card';
import { fetchOpenJobs } from '../../lib/jobs';
import { useTeacher } from '../../lib/auth';

export default function HomeScreen() {
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
      <ScreenHeader title={`Good morning, ${teacher.fullName.split(' ')[0]}`} subtitle="Your career dashboard" />

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={colors.primary}
          />
        }
      >
        {error !== null ? <ErrorBanner message={error} /> : null}

        {urgent.length > 0 ? (
          <View className="flex-row items-center gap-2.5 rounded-md border border-warning bg-warningBg px-3 py-2.5">
            <Text className="flex-1 text-[12.5px] font-semibold text-warning">
              {urgent.length === 1 ? '1 role closes today' : `${urgent.length} roles close today`}
            </Text>
          </View>
        ) : null}

        <Card className="p-3.5">
          <Text className="text-[13px] font-bold text-foreground">Auto-Apply is off</Text>
          <Text className="mt-1 text-[11.5px] leading-4 text-muted">
            Set your rules and we will apply to strong matches for you, before the shortlist fills.
          </Text>
        </Card>

        <View className="flex-row items-baseline justify-between">
          <Text className="text-[15px] font-bold tracking-tight text-foreground">Top matches for you</Text>
          <Link href="/(tabs)/jobs" className="text-xs font-semibold text-primary">See all</Link>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} className="py-8" />
        ) : topMatches.length === 0 ? (
          <EmptyState title="No open roles yet" body="New vacancies will appear here as schools post them." />
        ) : (
          topMatches.map((entry) => <JobCard key={entry.job.id} entry={entry} now={now} />)
        )}
      </ScrollView>
    </View>
  );
}
