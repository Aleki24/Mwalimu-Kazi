import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  formatClosing, formatLabel, formatPostedAge, formatSalaryFull, matchScore,
  type JobWithSchool, type MatchResult,
} from '@mwalimu/core';
import { colors, radius, shadow } from '@mwalimu/ui';
import { Card, EmptyState, ErrorBanner, SchoolMark, Tag } from '../../components/ui';
import { MatchBreakdown } from '../../components/match-breakdown';
import { fetchJobById } from '../../lib/jobs';
import { useTeacher } from '../../lib/auth';

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const teacher = useTeacher();
  const insets = useSafeAreaInsets();
  // 68 = the action plate's own height: a 48 button row plus 10 padding each side.
  const actionBarClearance = 68 + Math.max(insets.bottom, 10) + 16;
  const [entry, setEntry] = useState<JobWithSchool | null>(null);
  const [match, setMatch] = useState<MatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const found = await fetchJobById(id);
        if (cancelled) return;
        setEntry(found);
        setMatch(found === null ? null : matchScore(found.job, teacher));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load this role');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.mutedForeground} />
      </View>
    );
  }

  if (error !== null) {
    return <View className="flex-1 bg-background p-4"><ErrorBanner message={error} /></View>;
  }

  if (entry === null || match === null) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState title="Role not found" body="It may have closed or been taken down." />
      </View>
    );
  }

  const { job, schoolName } = entry;
  const closing = formatClosing(job.closesAt, now);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: job.title }} />

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: actionBarClearance }}>
        <View className="flex-row items-center gap-3">
          <SchoolMark name={schoolName} size={44} />
          <View className="min-w-0 flex-1">
            <Text className="text-sm font-medium text-foreground">{schoolName}</Text>
            <Text className="mt-0.5 text-[11.5px] text-mutedForeground">
              {formatLabel(job.county)} · posted {formatPostedAge(job.postedAt, now)}
            </Text>
          </View>
        </View>

        <MatchBreakdown match={match} />

        <Card className="px-3.5 py-3">
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text className="text-[11px] font-medium text-mutedForeground">Salary</Text>
              <Text className="mt-0.5 text-[15px] font-medium tracking-tight text-foreground">
                {formatSalaryFull(job.salary)}
              </Text>
            </View>
            {closing !== null ? (
              <View className="flex-1">
                <Text className="text-[11px] font-medium text-mutedForeground">Closing</Text>
                <Text className="mt-0.5 text-[15px] font-medium tracking-tight text-foreground">
                  {closing}
                </Text>
              </View>
            ) : null}
          </View>
        </Card>

        <View className="flex-row flex-wrap gap-1.5">
          {job.subjects.map((s) => <Tag key={s} label={formatLabel(s)} />)}
          <Tag label={formatLabel(job.jobType)} />
        </View>
      </ScrollView>

      {/*
        The action bar floats over the page rather than being welded to the
        bottom edge, matching the tab bar. Concentric corners: the plate is
        radius.xl2 (18) and the buttons inside are radius.md (8), so the padding
        between them is 10 — outer radius minus inner radius. Nested radii that
        do not share a centre read as a mistake even when nobody can say why.
      */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 10,
          paddingBottom: Math.max(insets.bottom, 10),
        }}
      >
        <View
          className="flex-row gap-2"
          style={{
            padding: 10,
            backgroundColor: colors.card,
            borderRadius: radius.xl2,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: colors.border,
            ...shadow.floating,
          }}
        >
          <Pressable
            accessibilityRole="button"
            className="h-12 flex-1 items-center justify-center border border-border bg-card"
            style={{ borderRadius: radius.md, borderCurve: 'continuous' }}
          >
            <Text className="text-sm font-medium text-foreground">Save</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={match.blocked}
            className={`h-12 flex-[2] items-center justify-center ${match.blocked ? 'bg-wash' : 'bg-primary'}`}
            style={{ borderRadius: radius.md, borderCurve: 'continuous' }}
          >
            <Text className={`text-sm font-medium ${match.blocked ? 'text-mutedForeground' : 'text-primaryForeground'}`}>
              {match.blocked ? 'Requirement not met' : 'Apply now'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
