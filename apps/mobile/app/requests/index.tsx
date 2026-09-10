import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, Stack, router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {
  ENGAGEMENT_LABEL, formatPostedAge, formatRate,
} from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import type { Tables } from '@mwalimu/types';
import {
  Button, Card, EmptyState, ErrorBanner, NoticeStrip, StatusBadge, Tag, centredContent,
} from '../../components/ui';
import { ApplicantCard } from '../../components/applicant-card';
import { MeetingIcons } from '../../components/meeting-icons';
import {
  fetchApplicants, fetchMyPostings, setApplicationStage, type Applicant,
} from '../../lib/recruiter';
import { openThread } from '../../lib/messages';
import { useTeacher } from '../../lib/auth';

type Stage = Tables<'applications'>['stage'];

/**
 * What you asked for, and who answered.
 *
 * The other half of a tuition request. A parent posts "maths tutor for Grade 6,
 * Tuesdays in Kilimani", teachers who match are notified, and the ones who
 * answer land here — with the same card the recruiter dashboard uses, because
 * a school triaging applicants and a parent choosing between three tutors are
 * the same act.
 *
 * This is also where the address is not. The listing gave an area; the exact
 * place is something the parent types into the conversation once they have
 * decided who they want, which is why the only action on an answer is to talk.
 */
export default function MyRequestsScreen() {
  const teacher = useTeacher();
  const [postings, setPostings] = useState<readonly Tables<'jobs'>[]>([]);
  const [selected, setSelected] = useState<Tables<'jobs'> | null>(null);
  const [applicants, setApplicants] = useState<readonly Applicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      const mine = await fetchMyPostings(teacher.id);
      setPostings(mine);
      setSelected((prev) => prev ?? mine[0] ?? null);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your requests');
    } finally {
      setLoading(false);
    }
  }, [teacher.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (selected === null) return;
    let cancelled = false;
    setLoadingAnswers(true);
    void (async () => {
      try {
        const next = await fetchApplicants(selected);
        if (!cancelled) setApplicants(next);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load who answered');
        }
      } finally {
        if (!cancelled) setLoadingAnswers(false);
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
    setApplicants((prev) => prev.map((a) =>
      a.application.id === applicationId
        ? { ...a, application: { ...a.application, stage } }
        : a));
    try {
      await setApplicationStage(applicationId, stage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save that');
      if (selected !== null) setApplicants(await fetchApplicants(selected));
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ title: 'Your requests' }} />
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Your requests' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, ...centredContent }}>
        {error !== null ? <ErrorBanner message={error} /> : null}

        {postings.length === 0 ? (
          <>
            <EmptyState
              title="You have not asked for anyone yet"
              body="Post what you need — a tutor for a subject, or a teacher for homeschooling — and teachers who match your subjects and area will see it."
            />
            <Button label="Post a request" onPress={() => router.push('/post/new')} />
          </>
        ) : null}

        {postings.map((job) => {
          const isSelected = selected?.id === job.id;
          const request = job.engagement !== 'employment';
          return (
            <Pressable
              key={job.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setSelected(job)}
            >
              <Card className={`gap-2 p-3.5 ${isSelected ? 'border border-primary' : ''}`}>
                <View className="flex-row items-start gap-2">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[13px] font-medium text-foreground">{job.title}</Text>
                    <Text className="mt-0.5 text-[11px] text-mutedForeground">
                      {formatRate(
                        job.salary_min === null ? undefined : {
                          min: job.salary_min,
                          ...(job.salary_max === null ? {} : { max: job.salary_max }),
                        },
                        job.rate_period,
                      )}
                      {' · posted '}{formatPostedAge(new Date(job.posted_at), now)}
                    </Text>
                  </View>
                  <StatusBadge
                    label={request ? ENGAGEMENT_LABEL[job.engagement] : 'Job'}
                    tone={request ? 'primary' : 'neutral'}
                  />
                </View>
                {request ? (
                  <View className="flex-row flex-wrap gap-1.5">
                    {job.area === null ? null : <Tag label={job.area} />}
                    <MeetingIcons job={{
                      meetsOnline: job.meets_online,
                      meetsAtStudent: job.meets_at_student,
                      meetsAtTeacher: job.meets_at_teacher,
                    }} />
                    {job.learner_level === null ? null : <Tag label={job.learner_level} />}
                    {job.sessions_per_week === null
                      ? null
                      : <Tag label={`${job.sessions_per_week}× a week`} />}
                  </View>
                ) : null}
              </Card>
            </Pressable>
          );
        })}

        {selected === null ? null : (
          <>
            <Text className="mt-2 text-[11px] font-medium uppercase tracking-wider text-mutedForeground">
              Who answered ({applicants.length})
            </Text>

            {selected.engagement !== 'employment' && applicants.length > 0 ? (
              <NoticeStrip>
                They can see the area you gave, not your address. Talk first, and share where you
                are when you have decided.
              </NoticeStrip>
            ) : null}

            {loadingAnswers ? (
              <ActivityIndicator color={colors.mutedForeground} className="py-6" />
            ) : applicants.length === 0 ? (
              <EmptyState
                title="Nobody yet"
                body="Teachers who match your subjects and county were notified. Answers appear here."
              />
            ) : (
              applicants.map((a) => (
                <ApplicantCard
                  key={a.application.id}
                  item={a}
                  now={now}
                  onStage={(stage) => void move(a.application.id, stage)}
                  onMessage={() => void message(a.application.id)}
                  onViewCv={() => router.push({
                    pathname: '/applicant/[id]/cv',
                    params: { id: a.application.teacher_id },
                  })}
                  verb={selected.engagement === 'employment' ? 'applied' : 'answered'}
                />
              ))
            )}
          </>
        )}

        {postings.length > 0 ? (
          <Link href="/post/new" asChild>
            <Pressable accessibilityRole="link" className="flex-row items-center justify-center gap-1.5 py-2">
              <Feather name="plus" size={14} color={colors.primary} />
              <Text className="text-[12.5px] font-medium text-primary">Post another request</Text>
            </Pressable>
          </Link>
        ) : null}
      </ScrollView>
    </View>
  );
}
