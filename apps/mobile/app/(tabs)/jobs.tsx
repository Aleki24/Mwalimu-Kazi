import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { filterJobs, rankJobs, type JobFilters, type JobWithSchool } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { Chip, EmptyState, ErrorBanner, ScreenHeader } from '../../components/ui';
import { JobCard } from '../../components/job-card';
import { fetchOpenJobs } from '../../lib/jobs';
import { useTeacher } from '../../lib/auth';

interface QuickFilter {
  readonly key: string;
  readonly label: string;
  readonly patch: JobFilters;
}

export default function JobsScreen() {
  const insets = useSafeAreaInsets();
  const teacher = useTeacher();
  const [all, setAll] = useState<readonly JobWithSchool[]>([]);
  const [skipped, setSkipped] = useState<readonly string[]>([]);
  const [active, setActive] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const result = await fetchOpenJobs();
      setAll(result.jobs);
      setSkipped(result.skipped);
      setNow(new Date());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /**
   * Two of these read the signed-in teacher, so they are built per render
   * rather than at module scope. Each is a partial JobFilters merged into the
   * active set — adding one needs no new filtering code, since `filterJobs`
   * already handles every field.
   */
  const quickFilters: readonly QuickFilter[] = useMemo(() => [
    { key: 'mine', label: 'My subjects', patch: { subjects: teacher.subjects } },
    { key: 'nearby', label: 'My county', patch: { counties: [teacher.county] } },
    { key: 'fulltime', label: 'Full-time', patch: { jobTypes: ['full_time'] } },
    { key: 'tsc', label: 'TSC roles', patch: { tscOnly: true } },
  ], [teacher]);

  const filters: JobFilters = useMemo(
    () => quickFilters.reduce<JobFilters>(
      (acc, f) => (active.has(f.key) ? { ...acc, ...f.patch } : acc),
      {},
    ),
    [active, quickFilters],
  );

  const results = useMemo(
    () => rankJobs(filterJobs(all, filters), teacher, now),
    [all, filters, now],
  );

  const toggle = (key: string) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScreenHeader
        title="Jobs"
        subtitle={loading ? 'Loading…' : `${results.length} of ${all.length} open roles`}
      />

      <View className="border-b border-border bg-card pb-3">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        >
          {quickFilters.map((f) => (
            <Pressable key={f.key} onPress={() => toggle(f.key)} accessibilityRole="button">
              <Chip label={f.label} selected={active.has(f.key)} />
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(entry) => entry.job.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          renderItem={({ item }) => <JobCard entry={item} now={now} />}
          ListHeaderComponent={
            <View className="gap-3">
              {error !== null ? <ErrorBanner message={error} /> : null}
              {skipped.length > 0 ? (
                <ErrorBanner
                  message={`${skipped.length} listing${skipped.length === 1 ? '' : 's'} could not be read and ${skipped.length === 1 ? 'was' : 'were'} hidden.`}
                />
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title="Nothing matches those filters"
              body="Try removing a filter — every open role is still here."
            />
          }
        />
      )}
    </View>
  );
}
