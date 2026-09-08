import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { closingSoon, rankJobs, type JobWithSchool, type RankedJob } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import {
  Avatar, Card, EmptyState, ErrorBanner, NoticeStrip, tabularNums,
} from '../../components/ui';
import { useTabBarClearance } from '../../components/floating-tab-bar';
import { JobCard } from '../../components/job-card';
import { fetchOpenJobs } from '../../lib/jobs';
import { fetchCareerSnapshot, type CareerSnapshot } from '../../lib/career';
import { fetchRule } from '../../lib/auto-apply';
import { useTeacher } from '../../lib/auth';

/** Routes with no tab of their own; the grid is how a teacher reaches them. */
const QUICK_ACCESS = [
  { href: '/saved', label: 'Saved jobs', icon: 'bookmark' },
  { href: '/applications', label: 'Applications', icon: 'send' },
  { href: '/notifications', label: 'Alerts', icon: 'bell' },
  { href: '/messages', label: 'Messages', icon: 'mail' },
  { href: '/feed', label: 'Staffroom', icon: 'message-square' },
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
  const [snapshot, setSnapshot] = useState<CareerSnapshot | null>(null);
  const [autoApplyOn, setAutoApplyOn] = useState(false);

  const load = useCallback(async () => {
    try {
      // In parallel: the snapshot is secondary, so it must not delay the jobs.
      const [{ jobs }, career, rule] = await Promise.all([
        fetchOpenJobs(), fetchCareerSnapshot(teacher), fetchRule(),
      ]);
      setAll(jobs);
      setSnapshot(career);
      setAutoApplyOn(rule?.enabled ?? false);
      setNow(new Date());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [teacher]);

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

        {/*
          Real counts, not a dashboard for its own sake. Applications, interviews
          and offers come from the stage column a school actually sets, so the
          numbers cannot flatter anyone; profile strength names the one thing
          most worth fixing next rather than showing a bare percentage.
        */}
        {snapshot === null ? null : (
          <Card className="gap-3 p-3.5">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-[13px] font-medium text-foreground">Your career so far</Text>
              <Text className="text-[11px] text-mutedForeground">
                Profile {snapshot.strength.percent}%
              </Text>
            </View>

            <View className="flex-row">
              {([
                ['Applications', snapshot.applications],
                ['Interviews', snapshot.interviews],
                ['Offers', snapshot.offers],
              ] as const).map(([label, value]) => (
                <View key={label} className="flex-1">
                  <Text
                    style={tabularNums}
                    className="text-[19px] font-medium tracking-tight text-foreground"
                  >
                    {value}
                  </Text>
                  <Text className="text-[11px] text-mutedForeground">{label}</Text>
                </View>
              ))}
            </View>

            {snapshot.strength.missing[0] === undefined ? null : (
              <Link href="/profile/cv" asChild>
                <Pressable accessibilityRole="link" className="flex-row items-center gap-1.5">
                  <Feather name="arrow-right" size={13} color={colors.primary} />
                  <Text className="text-[12px] font-medium text-primary">
                    {snapshot.strength.missing[0].label}
                  </Text>
                </Pressable>
              </Link>
            )}
          </Card>
        )}

        {/* Reads the real rule rather than always claiming to be off. */}
        <Link href="/auto-apply" asChild>
          <Pressable accessibilityRole="link">
            <Card className="flex-row items-center gap-3 p-3.5">
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-[13px] font-medium text-foreground">
                    Auto-Apply is {autoApplyOn ? 'on' : 'off'}
                  </Text>
                  {autoApplyOn ? (
                    <View
                      style={{ width: 6, height: 6, borderRadius: 999 }}
                      className="bg-successForeground"
                    />
                  ) : null}
                </View>
                <Text className="mt-1 text-[11.5px] leading-4 text-mutedForeground">
                  {autoApplyOn
                    ? 'Runs while the app is open, against the rules you set.'
                    : 'Set your rules and it will apply to strong matches for you.'}
                </Text>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Card>
          </Pressable>
        </Link>

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
