import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { filterJobs, rankJobs, type JobFilters, type JobWithSchool } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { Chip, EmptyState, ErrorBanner, ScreenHeader, SearchBar } from '../../components/ui';
import { useTabBarClearance } from '../../components/floating-tab-bar';
import { JobCard } from '../../components/job-card';
import { fetchJobsPage, type JobsCursor } from '../../lib/jobs';
import { fetchSavedJobIds, saveJob, unsaveJob } from '../../lib/saved';
import { useTeacher } from '../../lib/auth';

interface QuickFilter {
  readonly key: string;
  readonly label: string;
  readonly patch: JobFilters;
}

export default function JobsScreen() {
  const tabBarClearance = useTabBarClearance();
  const insets = useSafeAreaInsets();
  const teacher = useTeacher();
  const [all, setAll] = useState<readonly JobWithSchool[]>([]);
  const [skipped, setSkipped] = useState<readonly string[]>([]);
  const [active, setActive] = useState<ReadonlySet<string>>(new Set());
  const [query, setQuery] = useState('');
  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<JobsCursor | null>(null);
  const [done, setDone] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      // The saved set is secondary — a bookmark drawn a beat late is far
      // better than a list that waits on it.
      const [page, saved] = await Promise.all([fetchJobsPage(null), fetchSavedJobIds()]);
      setAll(page.jobs);
      setSkipped(page.skipped);
      setSavedIds(saved);
      setCursor(page.next);
      setDone(page.next === null);
      setNow(new Date());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    // All three guards matter: onEndReached fires repeatedly while a slow page
    // is in flight, and without them the same page lands two or three times.
    if (done || loadingMore || cursor === null) return;
    setLoadingMore(true);
    try {
      const page = await fetchJobsPage(cursor);
      setAll((prev) => [...prev, ...page.jobs]);
      setSkipped((prev) => [...prev, ...page.skipped]);
      setCursor(page.next);
      setDone(page.next === null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load more jobs');
    } finally {
      setLoadingMore(false);
    }
  };

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

  // The typed query is just another field on the same filter object, so the
  // chips and the search box cannot end up filtering through different paths.
  const filters: JobFilters = useMemo(() => {
    const fromChips = quickFilters.reduce<JobFilters>(
      (acc, f) => (active.has(f.key) ? { ...acc, ...f.patch } : acc),
      {},
    );
    const trimmed = query.trim();
    return trimmed === '' ? fromChips : { ...fromChips, query: trimmed };
  }, [active, quickFilters, query]);

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

  /**
   * The bookmark flips immediately and rolls back if the write fails. Waiting
   * on a round trip to fill in an icon makes a fast list feel broken; silently
   * keeping a save that did not happen is worse.
   */
  const toggleSave = async (jobId: string) => {
    const wasSaved = savedIds.has(jobId);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(jobId); else next.add(jobId);
      return next;
    });
    try {
      if (wasSaved) await unsaveJob(teacher.id, jobId);
      else await saveJob(teacher.id, jobId);
    } catch (cause) {
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(jobId); else next.delete(jobId);
        return next;
      });
      setError(cause instanceof Error ? cause.message : 'Could not update your saved jobs');
    }
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/*
        Search and filters stay pinned above the list rather than scrolling
        away with it: they are how you change what you are looking at, and
        having to scroll back up to narrow a long feed is the whole reason
        people give up on one.
      */}
      <View className="border-b border-border bg-card">
        <ScreenHeader
          title="Jobs"
          subtitle={loading ? 'Loading…' : `${results.length} of ${all.length} open roles`}
        />

        <View className="px-4 pb-3">
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search role, school or county"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 12 }}
        >
          {quickFilters.map((f) => (
            <Chip
              key={f.key}
              label={f.label}
              selected={active.has(f.key)}
              onPress={() => toggle(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(entry) => entry.job.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: tabBarClearance }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.6}
          onEndReached={() => void loadMore()}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={colors.mutedForeground} className="py-4" />
            : done && results.length > 0
              ? <Text className="py-4 text-center text-[11px] text-mutedForeground">
                  That is every open role.
                </Text>
              : null
          }
          renderItem={({ item }) => (
            <JobCard
              entry={item}
              now={now}
              saved={savedIds.has(item.job.id)}
              onToggleSave={(jobId) => void toggleSave(jobId)}
            />
          )}
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
              title={query.trim() === '' ? 'Nothing matches those filters' : `No roles match “${query.trim()}”`}
              body="Try removing a filter — every open role is still here."
            />
          }
        />
      )}
    </View>
  );
}
