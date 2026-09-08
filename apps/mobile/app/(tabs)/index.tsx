import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { closingSoon, formatLabel, rankJobs, type JobWithSchool, type RankedJob } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import {
  Avatar, Card, centredContent, EmptyState, ErrorBanner, NoticeStrip, tabularNums,
} from '../../components/ui';
import { HeroCard, HeroAction } from '../../components/hero-card';
import { ProgressRing } from '../../components/progress-ring';
import { PIPELINE_STAGES, pipelineProgress } from '../../components/pipeline';
import { useTabBarClearance } from '../../components/floating-tab-bar';
import { JobCard } from '../../components/job-card';
import { fetchOpenJobs } from '../../lib/jobs';
import { fetchCareerSnapshot, type CareerSnapshot, type LeadApplication } from '../../lib/career';
import { fetchRule } from '../../lib/auto-apply';
import { useTeacher } from '../../lib/auth';

/**
 * The things a teacher comes back for. Saved jobs, alerts and messages are one
 * tap away in the header rather than taking tiles: they are places you check,
 * and the grid is for things you go and do.
 *
 * Every route without a tab of its own has to appear in one of those two
 * places or it is unreachable — which is what nearly happened to Messages.
 */
const QUICK_ACTIONS = [
  { href: '/(tabs)/jobs', label: 'Find jobs', icon: 'search' },
  { href: '/applications', label: 'My applications', icon: 'send' },
  { href: '/profile/cv', label: 'Documents', icon: 'file-text' },
  { href: '/(tabs)/schools', label: 'Schools', icon: 'map-pin' },
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
    [all, teacher, now],
  );
  const urgent = useMemo(() => closingSoon(all, now), [all, now]);
  // Two, not three: the hero already spent the top of the screen, and a
  // shortlist you can take in at a glance is the point of a shortlist.
  const topMatches = ranked.slice(0, 2);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-1 bg-card px-5 pb-4 pt-2">
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-2xl font-medium tracking-tight text-foreground">
            {`Hi, ${teacher.fullName.split(' ')[0] ?? teacher.fullName}`}
          </Text>
          <Text className="mt-1 text-sm text-mutedForeground">Your career dashboard</Text>
        </View>

        <HeaderIcon href="/saved" icon="bookmark" label="Saved jobs" />
        <HeaderIcon href="/messages" icon="mail" label="Messages" />
        <HeaderIcon href="/notifications" icon="bell" label="Alerts" />
        <View className="pl-1.5">
          {/* Profile has no tab of its own; this is the way in. */}
          <Avatar name={teacher.fullName} size={40} onPress={() => router.push('/profile')} label="Your profile" />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: tabBarClearance, ...centredContent }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={colors.mutedForeground}
          />
        }
      >
        {error !== null ? <ErrorBanner message={error} /> : null}

        {/*
          The hero says the single most important true thing. That is the
          application furthest along if there is one, and otherwise the strongest
          open role — never an invented appointment.
        */}
        {snapshot?.lead != null ? (
          <LeadHero lead={snapshot.lead} />
        ) : topMatches[0] !== undefined ? (
          <HeroCard
            eyebrow="Your strongest match"
            title={topMatches[0].job.title}
            meta={`${topMatches[0].schoolName} · ${formatLabel(topMatches[0].job.county)}`}
            right={
              <ProgressRing
                step={topMatches[0].match.score}
                total={100}
                label={`${topMatches[0].match.score}%`}
                onDark
              />
            }
            footer={<HeroAction label="Read the role" />}
            onPress={() => router.push({ pathname: '/job/[id]', params: { id: topMatches[0]!.job.id } })}
          />
        ) : null}

        {urgent.length > 0 ? (
          <NoticeStrip tone="urgent">
            <Text className="text-sm text-foreground">
              {urgent.length === 1 ? '1 role closes today' : `${urgent.length} roles close today`}
            </Text>
          </NoticeStrip>
        ) : null}

        {/*
          Tiles wrap rather than sitting on a fixed 48.5% width, so the grid is
          2×2 on a phone and one row on a tablet without a width listener.
        */}
        <View className="flex-row flex-wrap gap-2.5">
          {QUICK_ACTIONS.map((item) => (
            <Link key={item.href} href={item.href} asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.label}
                style={{ flexBasis: '47%', flexGrow: 1 }}
              >
                <Card className="items-center gap-2 px-2 py-4">
                  <Feather name={item.icon} size={19} color={colors.primary} />
                  <Text numberOfLines={1} className="text-[11.5px] font-medium text-foreground">
                    {item.label}
                  </Text>
                </Card>
              </Pressable>
            </Link>
          ))}
        </View>

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

        <View className="flex-row items-baseline justify-between">
          <Text className="text-[15px] font-medium tracking-tight text-foreground">Matched for you</Text>
          <Link href="/(tabs)/jobs" className="text-xs font-medium text-primary">See all</Link>
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

/**
 * The hero when there is a live application: which school, how far along, and
 * a ring showing the position on the four-stage pipeline.
 */
function LeadHero({ lead }: { readonly lead: LeadApplication }) {
  const progress = pipelineProgress(lead.stage);

  return (
    <HeroCard
      eyebrow={formatLabel(lead.stage)}
      title={lead.schoolName}
      meta={lead.jobTitle}
      right={<ProgressRing step={progress.reached} total={PIPELINE_STAGES.length} onDark />}
      footer={<HeroAction label="Track this application" />}
      onPress={() => router.push('/applications')}
      accessibilityLabel={`${formatLabel(lead.stage)} at ${lead.schoolName} for ${lead.jobTitle}. Track this application.`}
    />
  );
}

/** A quiet round icon button in the header. */
function HeaderIcon({
  href, icon, label,
}: {
  // The router's own href type, not `string`: a typo in a route should fail
  // the build rather than render a link that goes nowhere.
  readonly href: React.ComponentProps<typeof Link>['href'];
  readonly icon: React.ComponentProps<typeof Feather>['name'];
  readonly label: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        hitSlop={8}
        className="h-10 w-10 items-center justify-center"
      >
        <Feather name={icon} size={19} color={colors.mutedForeground} />
      </Pressable>
    </Link>
  );
}
