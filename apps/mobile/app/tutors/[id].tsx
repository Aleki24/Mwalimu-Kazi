import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { ENGAGEMENT_LABEL, formatLabel, formatRate } from '@mwalimu/core';
import { colors, radius } from '@mwalimu/ui';
import type { Tables } from '@mwalimu/types';
import {
  Avatar, Card, centredContent, EmptyState, ErrorBanner, NoticeStrip, StatusBadge, Tag,
} from '../../components/ui';
import { MeetingList } from '../../components/meeting-icons';
import { fetchTutor, inviteTutor, type Tutor } from '../../lib/tutors';
import { fetchMyPostings } from '../../lib/recruiter';
import { useTeacher } from '../../lib/auth';

/**
 * One tutor, and the way to reach them.
 *
 * Getting in touch is not a bare message. The parent picks which of their
 * requests they are writing about, and the tutor is attached to it as an
 * invitation — so the teacher receives a conversation with the thing being
 * discussed already in it, and the parent's "Who answered" screen shows the
 * person they went and found alongside the people who came to them.
 */
function Fact({ label, value }: { label: string; value: string | null }) {
  if (value === null || value.trim() === '') return null;
  return (
    <View className="flex-row items-start gap-3 py-1.5">
      <Text className="w-[104px] text-[11.5px] text-mutedForeground">{label}</Text>
      <Text className="min-w-0 flex-1 text-[12.5px] text-foreground">{value}</Text>
    </View>
  );
}

export default function TutorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const teacher = useTeacher();
  const insets = useSafeAreaInsets();

  const [tutor, setTutor] = useState<Tutor | null>(null);
  const [requests, setRequests] = useState<readonly Tables<'jobs'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [found, mine] = await Promise.all([
          fetchTutor(id),
          fetchMyPostings(teacher.id),
        ]);
        if (cancelled) return;
        setTutor(found);
        setRequests(mine.filter((j) => j.engagement !== 'employment'));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not open that');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, teacher.id]);

  const invite = async (jobId: string) => {
    setBusy(true);
    setError(null);
    try {
      const threadId = await inviteTutor(jobId, id);
      router.push({ pathname: '/messages/[threadId]', params: { threadId } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start that conversation');
    } finally {
      setBusy(false);
      setChoosing(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ title: 'Tutor' }} />
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      </View>
    );
  }

  if (tutor === null) {
    return (
      <View className="flex-1 bg-background p-4">
        <Stack.Screen options={{ title: 'Tutor' }} />
        <EmptyState
          title="Not listed any more"
          body="This teacher is no longer offering private tuition here."
        />
      </View>
    );
  }

  const rate = formatRate(
    tutor.rateMin === null ? undefined : {
      min: tutor.rateMin,
      ...(tutor.rateMax === null ? {} : { max: tutor.rateMax }),
    },
    tutor.ratePeriod,
  );
  const mine = tutor.userId === teacher.id;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: tutor.fullName }} />
      <ScrollView
        contentContainerStyle={{
          padding: 16, gap: 12, paddingBottom: insets.bottom + 96, ...centredContent,
        }}
      >
        {error !== null ? <ErrorBanner message={error} /> : null}

        <View className="flex-row items-center gap-3">
          <Avatar name={tutor.fullName} size={52} />
          <View className="min-w-0 flex-1">
            <Text className="text-[17px] font-medium tracking-tight text-foreground">
              {tutor.fullName}
            </Text>
            {tutor.headline === null ? null : (
              <Text className="mt-0.5 text-[12.5px] text-mutedForeground">{tutor.headline}</Text>
            )}
          </View>
          {tutor.tscVerified ? <StatusBadge label="TSC verified" tone="success" /> : null}
        </View>

        <Card className="gap-1 p-3.5">
          <Fact label="Teaches" value={tutor.subjects.map(formatLabel).join(', ')} />
          <Fact label="Learners" value={tutor.learnerLevels.join(', ')} />
          <Fact label="Area" value={tutor.area} />
          <Fact
            label="County"
            value={tutor.county === null ? null : formatLabel(tutor.county)}
          />
          <Fact
            label="Experience"
            value={tutor.experienceYears > 0 ? `${tutor.experienceYears} years teaching` : null}
          />
          <Fact label="Rate" value={rate} />
          <Fact label="Gender" value={tutor.gender} />
          <View className="mt-2">
            <MeetingList job={{
              meetsOnline: tutor.meetsOnline,
              meetsAtStudent: tutor.meetsAtStudent,
              meetsAtTeacher: tutor.meetsAtTeacher,
            }}
            />
          </View>
        </Card>

        {tutor.about === null ? null : (
          <Card className="p-3.5">
            <Text className="text-[12.5px] leading-5 text-foreground">{tutor.about}</Text>
          </Card>
        )}

        <NoticeStrip tone="warning">
          <Text className="text-[11.5px] leading-4 text-mutedForeground">
            Listed by their own choice, and checked no further than the TSC badge above. Talk
            first, meet somewhere public or online to begin with, and never pay a deposit to
            secure a tutor.
          </Text>
        </NoticeStrip>

        {choosing ? (
          <Card className="gap-2 p-3.5">
            <Text className="text-[12.5px] font-medium text-foreground">
              Which request is this about?
            </Text>
            <Text className="text-[11px] leading-4 text-mutedForeground">
              They will see it along with your message, so they know what you are asking before
              they reply.
            </Text>
            {requests.map((j) => (
              <Pressable
                key={j.id}
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void invite(j.id)}
                className="flex-row items-center gap-2 rounded-md border border-border bg-card px-3 py-2.5"
              >
                <View className="min-w-0 flex-1">
                  <Text className="text-[12.5px] font-medium text-foreground">{j.title}</Text>
                  <Text className="text-[11px] text-mutedForeground">
                    {ENGAGEMENT_LABEL[j.engagement]}
                    {j.area === null ? '' : ` · ${j.area}`}
                  </Text>
                </View>
                <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => { setChoosing(false); router.push('/post/new'); }}
              className="flex-row items-center gap-1.5 py-2"
            >
              <Feather name="plus" size={14} color={colors.primary} />
              <Text className="text-[12.5px] font-medium text-primary">Post a new request</Text>
            </Pressable>
          </Card>
        ) : null}

        {busy ? <ActivityIndicator color={colors.mutedForeground} className="py-2" /> : null}
      </ScrollView>

      {mine ? null : (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 12 }}
        >
          <View style={centredContent} className="px-4">
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => {
                // Nothing to attach the conversation to yet, so send them to
                // write the request first rather than opening an empty chooser.
                if (requests.length === 0) router.push('/post/new');
                else setChoosing((v) => !v);
              }}
              style={{ borderRadius: radius.md, borderCurve: 'continuous' }}
              className="h-12 flex-row items-center justify-center gap-1.5 bg-primary"
            >
              <Feather name="mail" size={15} color={colors.primaryForeground} />
              <Text className="text-[13.5px] font-medium text-primaryForeground">
                {requests.length === 0
                  ? `Post a request to contact ${tutor.fullName.split(' ')[0]}`
                  : `Contact ${tutor.fullName.split(' ')[0]}`}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
