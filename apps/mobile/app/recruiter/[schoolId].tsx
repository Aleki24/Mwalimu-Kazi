import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link, Stack, router, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {
  formatLabel, formatPostedAge, formatSalary, matchBand,
} from '@mwalimu/core';
import type { Tables } from '@mwalimu/types';
import { colors, radius } from '@mwalimu/ui';
import {
  Avatar, Card, centredContent, Chip, EmptyState, ErrorBanner, NoticeStrip, tabularNums, Tag,
} from '../../components/ui';
import {
  fetchApplicants, fetchSchoolRoles, setApplicationStage,
  type Applicant, type SchoolRole,
} from '../../lib/recruiter';
import { openThread } from '../../lib/messages';
import { ApplicantCard } from '../../components/applicant-card';

type Stage = Tables<'applications'>['stage'];

/**
 * The stages a school can move someone to, in order.
 *
 * 'saved' and 'withdrawn' are absent on purpose: the first belongs to the
 * teacher's own bookmarking, and the second is theirs to declare. A school
 * marking someone as having withdrawn would be putting words in their mouth.
 */
export default function RecruiterSchoolScreen() {
  const { schoolId } = useLocalSearchParams<{ schoolId: string }>();
  const insets = useSafeAreaInsets();

  const [roles, setRoles] = useState<readonly SchoolRole[]>([]);
  const [selected, setSelected] = useState<SchoolRole | null>(null);
  const [applicants, setApplicants] = useState<readonly Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingApplicants, setLoadingApplicants] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const list = await fetchSchoolRoles(schoolId);
      setRoles(list);
      // Open the role with people waiting, since that is why you came.
      setSelected((prev) =>
        prev === null ? (list.find((r) => r.newApplicants > 0) ?? list[0] ?? null)
        : (list.find((r) => r.job.id === prev.job.id) ?? null));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your roles');
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (selected === null) { setApplicants([]); return; }
    let cancelled = false;
    setLoadingApplicants(true);
    void (async () => {
      try {
        const list = await fetchApplicants(selected.job);
        if (!cancelled) setApplicants(list);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load applicants');
      } finally {
        if (!cancelled) setLoadingApplicants(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selected]);

  const message = async (applicationId: string) => {
    try {
      const threadId = await openThread(applicationId);
      router.push({ pathname: '/messages/[threadId]', params: { threadId } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open that conversation');
    }
  };

  const move = async (applicationId: string, stage: Stage) => {
    // Optimistic: a recruiter triaging twenty people should not wait on each.
    setApplicants((prev) => prev.map((a) =>
      a.application.id === applicationId
        ? { ...a, application: { ...a.application, stage } }
        : a));
    try {
      await setApplicationStage(applicationId, stage);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update that');
      const fresh = selected === null ? [] : await fetchApplicants(selected.job);
      setApplicants(fresh);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Applicants' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32, ...centredContent }}>
        {error !== null ? <ErrorBanner message={error} /> : null}

        {/* Posting from here carries the school id, so the role is the school's. */}
        <Link href={{ pathname: '/post/new', params: { schoolId } }} asChild>
          <Pressable accessibilityRole="link">
            <Card className="flex-row items-center gap-2.5 p-3.5">
              <Feather name="plus" size={15} color={colors.primary} />
              <Text className="flex-1 text-[13px] font-medium text-primary">
                Post a role for this school
              </Text>
            </Card>
          </Pressable>
        </Link>

        {loading ? (
          <ActivityIndicator color={colors.mutedForeground} className="py-8" />
        ) : roles.length === 0 ? (
          <EmptyState
            title="No roles yet"
            body="Post a vacancy and applicants will appear here, scored against it."
          />
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {roles.map((r) => (
                <Pressable
                  key={r.job.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: selected?.job.id === r.job.id }}
                  onPress={() => setSelected(r)}
                  style={{ borderRadius: radius.pill }}
                  className={`justify-center px-4 py-2.5 ${
                    selected?.job.id === r.job.id ? 'bg-foreground' : 'border border-border bg-card'
                  }`}
                >
                  <Text
                    className={`text-[12.5px] ${
                      selected?.job.id === r.job.id ? 'text-card' : 'text-foreground'
                    }`}
                  >
                    {r.job.title}
                    {r.newApplicants > 0 ? `  ·  ${r.newApplicants} new` : ''}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {selected === null ? null : (
              <Card className="gap-1 p-3.5">
                <Text className="text-[13px] font-medium text-foreground">{selected.job.title}</Text>
                <Text className="text-[11.5px] text-mutedForeground">
                  {formatSalary(
                    selected.job.salary_min === null
                      ? undefined
                      : {
                          min: selected.job.salary_min,
                          ...(selected.job.salary_max === null ? {} : { max: selected.job.salary_max }),
                        },
                  )}
                  {' · '}
                  {selected.applicants} {selected.applicants === 1 ? 'applicant' : 'applicants'}
                  {selected.job.published ? '' : ' · unpublished'}
                </Text>
              </Card>
            )}

            {loadingApplicants ? (
              <ActivityIndicator color={colors.mutedForeground} className="py-6" />
            ) : applicants.length === 0 ? (
              <EmptyState
                title="Nobody has applied yet"
                body="Teachers whose subjects and county match this role are notified when it is published."
              />
            ) : (
              applicants.map((a) => (
                <ApplicantCard
                  key={a.application.id}
                  item={a}
                  now={now}
                  onStage={(stage) => void move(a.application.id, stage)}
                  onMessage={() => void message(a.application.id)}
                />
              ))
            )}

            <NoticeStrip>
              <Text className="text-[11.5px] leading-4 text-mutedForeground">
                You can see these profiles because they applied to your vacancy. Their CV is theirs
                to send — it is not readable from here.
              </Text>
            </NoticeStrip>
          </>
        )}
      </ScrollView>
    </View>
  );
}
