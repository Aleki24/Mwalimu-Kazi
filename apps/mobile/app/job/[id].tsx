import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
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
import { fetchSavedJobIds, saveJob, unsaveJob } from '../../lib/saved';
import { applyToJob, fetchAppliedJobIds } from '../../lib/applications';
import { addJobComment, fetchJobComments } from '../../lib/social';
import { CommentThread } from '../../components/comment-thread';
import { NoticeStrip } from '../../components/ui';
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
  const [saved, setSaved] = useState(false);
  const [applied, setApplied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        // One round trip each, in parallel: the action bar cannot render its
        // real state until it knows whether this job is already saved or
        // applied to, and showing "Apply now" to someone who already applied
        // is worse than a moment of loading.
        const [found, savedIds, appliedIds] = await Promise.all([
          fetchJobById(id),
          fetchSavedJobIds(),
          fetchAppliedJobIds(),
        ]);
        if (cancelled) return;
        setEntry(found);
        setMatch(found === null ? null : matchScore(found.job, teacher));
        setSaved(savedIds.has(id));
        setApplied(appliedIds.has(id));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load this role');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const toggleSave = async () => {
    const next = !saved;
    setSaved(next); // optimistic: a save that lags feels broken
    try {
      await (next ? saveJob(teacher.id, id) : unsaveJob(teacher.id, id));
    } catch (cause) {
      setSaved(!next);
      setError(cause instanceof Error ? cause.message : 'Could not save this role');
    }
  };

  const submit = async (score: number) => {
    // Not optimistic. Saving is reversible in one tap; sending an application
    // to a school is not, so this one waits for the database to confirm.
    setBusy(true);
    try {
      await applyToJob(teacher.id, id, score);
      setApplied(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send your application');
    } finally {
      setBusy(false);
    }
  };

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

        {/*
          Provenance, stated plainly. A listing with no verified school behind
          it is how a placement scam presents itself, and the teacher deciding
          whether to send their documents is the person who needs to know.
        */}
        {entry.posterKind === 'individual' ? (
          <NoticeStrip tone="warning">
            <Text className="text-[11.5px] leading-4 text-mutedForeground">
              Posted by an individual, not a verified school. Never pay a fee to apply for a
              teaching job.
            </Text>
          </NoticeStrip>
        ) : null}

        <Card className="px-3.5 py-3">
          <CommentThread
            load={() => fetchJobComments(id)}
            send={(body) => addJobComment(id, teacher.id, body)}
            emptyHint="No questions yet. Comments here are public and shown under your name."
          />
        </Card>
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
            accessibilityState={{ selected: saved }}
            accessibilityLabel={saved ? 'Remove from saved' : 'Save this role'}
            onPress={() => void toggleSave()}
            className={`h-12 flex-1 flex-row items-center justify-center gap-1.5 border border-border ${saved ? 'bg-wash' : 'bg-card'}`}
            style={{ borderRadius: radius.md, borderCurve: 'continuous' }}
          >
            <Feather
              name="bookmark"
              size={15}
              color={colors.foreground}
              // Filled once saved, so the state is legible without reading it.
              style={saved ? undefined : { opacity: 0.7 }}
            />
            <Text className="text-sm font-medium text-foreground">{saved ? 'Saved' : 'Save'}</Text>
          </Pressable>

          {/*
            Three states, and they are not interchangeable. Blocked means a
            must-have is unmet and applying would waste everyone's time.
            Applied is terminal here — the row exists, and a second tap must not
            look like it might do something.
          */}
          <Pressable
            accessibilityRole="button"
            disabled={match.blocked || applied || busy}
            onPress={() => void submit(match.score)}
            className={`h-12 flex-[2] flex-row items-center justify-center gap-1.5 ${
              match.blocked || applied ? 'bg-wash' : 'bg-primary'
            }`}
            style={{ borderRadius: radius.md, borderCurve: 'continuous' }}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <>
                {applied ? <Feather name="check" size={15} color={colors.successForeground} /> : null}
                <Text
                  className={`text-sm font-medium ${
                    match.blocked ? 'text-mutedForeground'
                    : applied ? 'text-foreground'
                    : 'text-primaryForeground'
                  }`}
                >
                  {match.blocked ? 'Requirement not met' : applied ? 'Applied' : 'Apply now'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}
