import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { formatLabel, formatPostedAge } from '@mwalimu/core';
import { County, JobType } from '@mwalimu/types';
import { colors, radius } from '@mwalimu/ui';
import {
  Button, Card, Chip, ErrorBanner, EmptyState, NoticeStrip, ToggleRow, tabularNums,
} from '../components/ui';
import { useTeacher } from '../lib/auth';
import {
  fetchAutoApplyScreen, runAutoApply, saveRule,
  type AutoApplyEvent, type RuleRow, type RunSummary,
} from '../lib/auto-apply';

/** Tone per outcome. Semantic colour tints the text; it never fills a row. */
const OUTCOME: Readonly<Record<string, { label: string; tone: string; icon: string }>> = {
  applied: { label: 'Applied', tone: 'text-successForeground', icon: 'send' },
  held: { label: 'Held for you', tone: 'text-warningForeground', icon: 'pause-circle' },
  skipped: { label: 'Skipped', tone: 'text-mutedForeground', icon: 'minus-circle' },
  failed: { label: 'Failed', tone: 'text-destructiveForeground', icon: 'alert-circle' },
};

function ActivityRow({ item, now }: { item: AutoApplyEvent; now: Date }) {
  const tone = OUTCOME[item.event.outcome] ?? OUTCOME.skipped;
  if (tone === undefined) return null;
  return (
    <View className="flex-row items-start gap-2.5 border-b border-border py-2.5">
      <Feather
        name={tone.icon as React.ComponentProps<typeof Feather>['name']}
        size={14}
        color={colors.mutedForeground}
        style={{ marginTop: 1 }}
      />
      <View className="min-w-0 flex-1">
        <Text className="text-[12.5px] font-medium text-foreground">
          {item.jobTitle ?? 'A role that has since closed'}
        </Text>
        <Text className="text-[11px] text-mutedForeground">
          {[item.schoolName, item.event.reason].filter((p) => p !== null && p !== '').join(' · ')}
        </Text>
      </View>
      <View className="items-end">
        <Text className={`text-[11px] font-medium ${tone.tone}`}>{tone.label}</Text>
        <Text className="text-[10.5px] text-mutedForeground">
          {formatPostedAge(new Date(item.event.created_at), now)}
        </Text>
      </View>
    </View>
  );
}

export default function AutoApplyScreen() {
  const teacher = useTeacher();
  const insets = useSafeAreaInsets();

  const [rule, setRule] = useState<RuleRow | null>(null);
  const [events, setEvents] = useState<readonly AutoApplyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [now] = useState(() => new Date());

  // Draft state, so a half-typed salary does not hit the database.
  const [enabled, setEnabled] = useState(false);
  const [subjects, setSubjects] = useState<readonly string[]>([]);
  const [counties, setCounties] = useState<readonly string[]>([]);
  const [jobTypes, setJobTypes] = useState<readonly string[]>([]);
  const [minSalary, setMinSalary] = useState('');
  const [minMatch, setMinMatch] = useState(85);
  const [weekly, setWeekly] = useState(20);
  const [review, setReview] = useState(false);

  const load = useCallback(async () => {
    try {
      const screen = await fetchAutoApplyScreen();
      setRule(screen.rule);
      setEvents(screen.events);
      // Seeded from the teacher's own profile the first time. A rule that
      // starts empty cannot match anything, which reads as the feature being
      // broken rather than unconfigured.
      setEnabled(screen.rule?.enabled ?? false);
      setSubjects(screen.rule?.subjects ?? teacher.subjects);
      setCounties(screen.rule?.counties ?? [teacher.county]);
      setJobTypes(screen.rule?.job_types ?? []);
      setMinSalary(screen.rule?.min_salary === null || screen.rule?.min_salary === undefined
        ? '' : String(screen.rule.min_salary));
      setMinMatch(screen.rule?.min_match_score ?? 85);
      setWeekly(screen.rule?.weekly_limit ?? 20);
      setReview(screen.rule?.require_review_before_sending ?? false);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your rules');
    } finally {
      setLoading(false);
    }
  }, [teacher]);

  useEffect(() => { void load(); }, [load]);

  const toggle = (list: readonly string[], value: string): readonly string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  const persist = async (over: Partial<RuleRow> = {}) => {
    const salary = Number.parseInt(minSalary, 10);
    await saveRule({
      teacher_id: teacher.id,
      enabled,
      subjects: [...subjects],
      counties: [...counties],
      job_types: [...jobTypes] as RuleRow['job_types'],
      min_salary: Number.isInteger(salary) && salary > 0 ? salary : null,
      min_match_score: minMatch,
      weekly_limit: weekly,
      // Daily is derived rather than asked for. Two numbers that can
      // contradict each other is a way to make a form feel like paperwork.
      daily_limit: Math.max(1, Math.min(20, Math.ceil(weekly / 5))),
      require_review_before_sending: review,
      ...over,
    });
  };

  const save = async () => {
    if (subjects.length === 0 || counties.length === 0) {
      setError('Pick at least one subject and one county.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await persist();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your rules');
    } finally {
      setBusy(false);
    }
  };

  const runNow = async () => {
    setBusy(true);
    setError(null);
    setSummary(null);
    try {
      await persist();
      const fresh = await fetchAutoApplyScreen();
      if (fresh.rule === null) throw new Error('Save your rules first');
      setSummary(await runAutoApply(teacher, fresh.rule));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Auto-Apply could not run');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ title: 'Auto-Apply' }} />
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Auto-Apply' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <Card className="gap-2 p-3.5">
          <ToggleRow
            label="Auto-Apply"
            hint={enabled ? 'On — rules below decide what gets sent' : 'Off — nothing is sent'}
            value={enabled}
            onValueChange={setEnabled}
          />
        </Card>

        {/*
          Said here, not only in the code. The runner is the app, so it acts
          when the app is open. A teacher who believed it ran overnight and
          found it had not would have been misled by us.
        */}
        <NoticeStrip tone="warning">
          <Text className="text-[11.5px] leading-4 text-mutedForeground">
            Auto-Apply runs while the app is open, not overnight. Open it daily, or use Run now
            below.
          </Text>
        </NoticeStrip>

        <Card className="gap-3 p-3.5">
          <Text className="text-[12.5px] font-medium text-foreground">Only apply to</Text>

          <View className="gap-1.5">
            <Text className="text-[11.5px] text-mutedForeground">Subjects</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {[...new Set([...teacher.subjects, ...subjects])].map((s) => (
                <Chip
                  key={s}
                  label={formatLabel(s)}
                  selected={subjects.includes(s)}
                  onPress={() => setSubjects(toggle(subjects, s))}
                />
              ))}
            </View>
          </View>

          <View className="gap-1.5">
            <Text className="text-[11.5px] text-mutedForeground">Counties</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {County.options.map((c) => (
                <Chip
                  key={c}
                  label={formatLabel(c)}
                  selected={counties.includes(c)}
                  onPress={() => setCounties(toggle(counties, c))}
                />
              ))}
            </ScrollView>
          </View>

          <View className="gap-1.5">
            <Text className="text-[11.5px] text-mutedForeground">
              Job types {jobTypes.length === 0 ? '— any' : ''}
            </Text>
            <View className="flex-row flex-wrap gap-1.5">
              {JobType.options.map((t) => (
                <Chip
                  key={t}
                  label={formatLabel(t)}
                  selected={jobTypes.includes(t)}
                  onPress={() => setJobTypes(toggle(jobTypes, t))}
                />
              ))}
            </View>
          </View>
        </Card>

        <Card className="gap-3 p-3.5">
          <Text className="text-[12.5px] font-medium text-foreground">Thresholds</Text>

          <View className="gap-1.5">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-[11.5px] text-mutedForeground">Minimum match</Text>
              <Text style={tabularNums} className="text-[13px] font-medium text-foreground">
                {minMatch}%
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-1.5">
              {[70, 75, 80, 85, 90, 95].map((n) => (
                <Chip key={n} label={`${n}%`} selected={minMatch === n} onPress={() => setMinMatch(n)} />
              ))}
            </View>
            <Text className="text-[10.5px] leading-4 text-mutedForeground">
              A role that fails a must-have is capped below every threshold, so it can never be
              sent to automatically whatever you choose here.
            </Text>
          </View>

          <View className="gap-1.5">
            <Text className="text-[11.5px] text-mutedForeground">Minimum salary (optional)</Text>
            <TextInput
              value={minSalary}
              onChangeText={setMinSalary}
              placeholder="e.g. 40000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              className="h-11 rounded-md border border-border bg-card px-3 text-[14px] text-foreground"
            />
            <Text className="text-[10.5px] leading-4 text-mutedForeground">
              A listing that states no salary cannot clear a floor, so setting one skips them.
            </Text>
          </View>

          <View className="gap-1.5">
            <View className="flex-row items-baseline justify-between">
              <Text className="text-[11.5px] text-mutedForeground">Most per week</Text>
              <Text style={tabularNums} className="text-[13px] font-medium text-foreground">
                {weekly}
              </Text>
            </View>
            <View className="flex-row flex-wrap gap-1.5">
              {[5, 10, 20, 30].map((n) => (
                <Chip key={n} label={String(n)} selected={weekly === n} onPress={() => setWeekly(n)} />
              ))}
            </View>
          </View>

          <ToggleRow
            label="Show me each one first"
            hint="Holds matches for your approval instead of sending them"
            value={review}
            onValueChange={setReview}
          />
        </Card>

        {error !== null ? <ErrorBanner message={error} /> : null}

        {summary === null ? null : (
          <NoticeStrip tone={summary.applied > 0 ? 'success' : 'neutral'}>
            <Text className="text-[11.5px] leading-4 text-mutedForeground">
              Checked {summary.considered} open {summary.considered === 1 ? 'role' : 'roles'} ·{' '}
              {summary.applied} applied · {summary.held} held · {summary.skipped} skipped
            </Text>
          </NoticeStrip>
        )}

        {busy ? (
          <ActivityIndicator color={colors.mutedForeground} className="py-3" />
        ) : (
          <View className="gap-2">
            <Button label="Save rules" onPress={() => void save()} />
            <Pressable
              accessibilityRole="button"
              onPress={() => void runNow()}
              style={{ borderRadius: radius.pill }}
              className="h-11 flex-row items-center justify-center gap-1.5 border border-border bg-card"
            >
              <Feather name="play" size={13} color={colors.foreground} />
              <Text className="text-[13px] font-medium text-foreground">Save and run now</Text>
            </Pressable>
          </View>
        )}

        <Card className="gap-1 p-3.5">
          <Text className="text-[12.5px] font-medium text-foreground">Activity</Text>
          {events.length === 0 ? (
            <Text className="py-2 text-[11.5px] leading-4 text-mutedForeground">
              Nothing yet. Everything Auto-Apply does in your name is listed here, including what
              it chose not to send.
            </Text>
          ) : (
            events.map((item) => <ActivityRow key={item.event.id} item={item} now={now} />)
          )}
        </Card>

        {rule === null ? null : (
          <Text className="text-center text-[10.5px] text-mutedForeground">
            Rules last saved {formatPostedAge(new Date(rule.updated_at), now)}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
