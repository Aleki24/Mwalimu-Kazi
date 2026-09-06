import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { formatLabel, formatPostedAge } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import type { Tables } from '@mwalimu/types';
import { EmptyState, ErrorBanner } from '../components/ui';
import { JobCard } from '../components/job-card';
import { fetchApplications, type AppliedJob } from '../lib/applications';
import { useTeacher } from '../lib/auth';
import { matchScore } from '@mwalimu/core';

type Stage = Tables<'applications'>['stage'];

/**
 * Tone per stage. Semantic colour tints the text only — the pipeline is
 * information, not a status light, and a wall of coloured fills would make the
 * list harder to read, not easier.
 */
const STAGE_TONE: Readonly<Record<Stage, string>> = {
  saved: 'text-mutedForeground',
  applied: 'text-mutedForeground',
  viewed: 'text-infoForeground',
  shortlisted: 'text-successForeground',
  interview: 'text-successForeground',
  offered: 'text-successForeground',
  rejected: 'text-mutedForeground',
  withdrawn: 'text-mutedForeground',
};

export default function ApplicationsScreen() {
  const teacher = useTeacher();
  const [items, setItems] = useState<readonly AppliedJob[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      setItems(await fetchApplications());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Applications' }} />
      {loading ? (
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.application.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          ListHeaderComponent={error !== null ? <ErrorBanner message={error} /> : null}
          ListEmptyComponent={
            <EmptyState
              title="No applications yet"
              body="Apply from a job page and it will appear here, with whatever the school does next."
            />
          }
          renderItem={({ item }) => (
            <View className="gap-1.5">
              <JobCard
                entry={{ ...item.entry, match: matchScore(item.entry.job, teacher) }}
                now={now}
              />
              <View className="flex-row items-baseline gap-2 px-1">
                <Text className={`text-[11.5px] font-medium ${STAGE_TONE[item.application.stage]}`}>
                  {formatLabel(item.application.stage)}
                </Text>
                <Text className="text-[11px] text-mutedForeground">
                  {/*
                    The score the school received, not today's. It was frozen at
                    submission so the record cannot move under either party.
                  */}
                  sent {formatPostedAge(new Date(item.application.created_at), now)} at{' '}
                  {item.application.match_score}% match
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}
