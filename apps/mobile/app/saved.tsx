import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { Stack } from 'expo-router';
import { rankJobs, type JobWithSchool, type RankedJob } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { EmptyState, ErrorBanner } from '../components/ui';
import { JobCard } from '../components/job-card';
import { fetchSavedJobs } from '../lib/saved';
import { useTeacher } from '../lib/auth';

export default function SavedScreen() {
  const teacher = useTeacher();
  const [jobs, setJobs] = useState<readonly JobWithSchool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      setJobs(await fetchSavedJobs());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load saved jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const ranked: readonly RankedJob[] = rankJobs(jobs, teacher, now);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Saved jobs' }} />
      {loading ? (
        <ActivityIndicator color={colors.primary} className="py-10" />
      ) : (
        <FlatList
          data={ranked}
          keyExtractor={(entry) => entry.job.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          ListHeaderComponent={error !== null ? <ErrorBanner message={error} /> : null}
          ListEmptyComponent={
            <EmptyState
              title="Nothing saved yet"
              body="Save a role from the job list and it will wait here — with its closing date."
            />
          }
          renderItem={({ item }) => <JobCard entry={item} now={now} />}
        />
      )}
    </View>
  );
}
