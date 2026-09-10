import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  County, EngagementKind, GenderPreference, JobType, PosterRole, RatePeriod, TeachingLevel,
} from '@mwalimu/types';
import type { EngagementKind as Engagement } from '@mwalimu/types';
import {
  ENGAGEMENT_LABEL, GENDER_PREFERENCE_LABEL, LEVEL_LABEL, POSTER_ROLE_LABEL, formatLabel,
} from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import {
  Button, Card, centredContent, Chip, ErrorBanner, NoticeStrip, WhyDisabled,
  ToggleRow,
} from '../../components/ui';
import { useTeacher } from '../../lib/auth';
import { fetchPostableSchools, postJob } from '../../lib/post-job';

/**
 * Post a vacancy as an individual.
 *
 * Deliberately spare. A school posting through a recruiter account gets the
 * full form; this is the path for a head of department who needs a locum by
 * Monday, and every extra required field here is a reason to give up and post
 * it in a WhatsApp group instead.
 */
export default function NewJobScreen() {
  const teacher = useTeacher();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ schoolId?: string }>();

  const [schools, setSchools] = useState<ReadonlyArray<{ id: string; name: string }>>([]);
  const [schoolId, setSchoolId] = useState<string | null>(params.schoolId ?? null);

  useEffect(() => {
    void (async () => {
      try {
        const mine = await fetchPostableSchools();
        setSchools(mine);
        // Default to the school when there is exactly one and nothing was
        // passed: a recruiter with one school almost never means "individual".
        setSchoolId((prev) => prev ?? (mine.length === 1 ? (mine[0]?.id ?? null) : null));
      } catch {
        // Not being able to list schools is not a reason to block posting as
        // an individual, which is what most people are doing here.
      }
    })();
  }, []);

  const [title, setTitle] = useState('');
  const [county, setCounty] = useState<County>(teacher.county);
  const [subjects, setSubjects] = useState('');
  const [jobType, setJobType] = useState<JobType>('full_time');
  const [salaryMin, setSalaryMin] = useState('');
  const [salaryMax, setSalaryMax] = useState('');
  const [engagement, setEngagement] = useState<Engagement>('employment');
  const [ratePeriod, setRatePeriod] = useState<RatePeriod>('month');
  const [meetsOnline, setMeetsOnline] = useState(false);
  const [meetsAtStudent, setMeetsAtStudent] = useState(true);
  const [meetsAtTeacher, setMeetsAtTeacher] = useState(false);
  const [level, setLevel] = useState<TeachingLevel>('intermediate');
  const [posterRole, setPosterRole] = useState<PosterRole>('parent');
  const [preferredGender, setPreferredGender] = useState<GenderPreference>('any');
  const [prefersLocality, setPrefersLocality] = useState('');
  const [area, setArea] = useState('');
  const [learnerLevel, setLearnerLevel] = useState('');
  const [sessions, setSessions] = useState('');

  const isRequest = engagement !== 'employment';
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  const subjectList = subjects.split(',').map((s) => s.trim().toLowerCase()).filter((s) => s !== '');
  const missing = [
    ...(title.trim().length >= 3 ? [] : [isRequest ? 'a short title' : 'a role title']),
    ...(subjectList.length > 0 ? [] : ['at least one subject']),
    // The database refuses a request without these, and it is a better error
    // here than a constraint violation after the button.
    ...(isRequest && area.trim().length < 2 ? ['the area'] : []),
    ...(isRequest && !meetsOnline && !meetsAtStudent && !meetsAtTeacher
      ? ['at least one way of meeting']
      : []),
  ];
  const ready = missing.length === 0;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await postJob({
        // A request is never a school's, whoever is posting it.
        schoolId: isRequest ? null : schoolId,
        title: title.trim(),
        county,
        subjects: subjectList,
        jobType,
        salaryMin: salaryMin.trim() === '' ? null : Number(salaryMin),
        salaryMax: salaryMax.trim() === '' ? null : Number(salaryMax),
        engagement,
        ratePeriod: isRequest ? ratePeriod : 'month',
        meetsOnline: isRequest && meetsOnline,
        meetsAtStudent: isRequest && meetsAtStudent,
        meetsAtTeacher: isRequest && meetsAtTeacher,
        level: isRequest ? level : null,
        posterRole: isRequest ? posterRole : null,
        preferredGender: isRequest ? preferredGender : null,
        prefersLocality: isRequest && prefersLocality.trim() !== ''
          ? prefersLocality.trim()
          : null,
        area: isRequest ? area.trim() : null,
        learnerLevel: isRequest && learnerLevel.trim() !== '' ? learnerLevel.trim() : null,
        sessionsPerWeek: isRequest && sessions.trim() !== '' ? Number(sessions) : null,
      });
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not post this role');
    } finally {
      setSaving(false);
    }
  };

  if (sent) {
    return (
      <View className="flex-1 justify-center gap-4 bg-background px-6">
        <Stack.Screen options={{ title: 'Posted' }} />
        <Text className="text-center text-[15px] font-medium text-foreground">
          {isRequest ? 'Your request is live' : 'Your role is live'}
        </Text>
        <Text className="text-center text-[12.5px] leading-5 text-mutedForeground">
          {isRequest
            ? 'Teachers who match your subjects and area have been notified. Anyone who answers appears under Your requests, and you can talk to them there before sharing where you are.'
            : schoolId === null
              ? 'It is labelled as posted by an individual rather than a verified school, so teachers know who they are dealing with.'
              : 'Matching teachers have been notified, and anyone who applies will appear under For schools.'}
        </Text>
        <Button label="Done" onPress={() => (router.canGoBack() ? router.back() : router.replace('/jobs'))} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Post a role' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32, ...centredContent }}
        keyboardShouldPersistTaps="handled"
      >
        {/*
          First, because it decides what the rest of the form is. A school
          vacancy and "someone to teach my son maths on Tuesdays" are not the
          same act, and asking afterwards would mean re-asking everything.
        */}
        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">What are you posting?</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {/* Straight off the enum, so a kind can never be filterable on
                Jobs and unpostable here — 'assignment' was exactly that. */}
            {EngagementKind.options.map((k) => (
              <Chip
                key={k}
                label={k === 'employment' ? 'A job' : ENGAGEMENT_LABEL[k]}
                selected={engagement === k}
                onPress={() => {
                  setEngagement(k);
                  // Tuition is priced by the hour far more often than by the
                  // month; a one-off piece of work is priced by the piece.
                  setRatePeriod(
                    k === 'employment' ? 'month' : k === 'assignment' ? 'session' : 'hour',
                  );
                  if (k !== 'employment') setJobType('part_time');
                  if (k === 'assignment') setSessions('');
                }}
              />
            ))}
          </View>
        </View>

        {isRequest ? (
          <NoticeStrip>
            Teachers will see the area, not your address. Share where exactly you are in the
            conversation, once you have decided who you want.
          </NoticeStrip>
        ) : null}

        {isRequest || schools.length === 0 ? null : (
          <View className="gap-2">
            <Text className="text-[13px] font-medium text-foreground">Posting as</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {schools.map((s) => (
                <Chip
                  key={s.id}
                  label={s.name}
                  selected={schoolId === s.id}
                  onPress={() => setSchoolId(s.id)}
                />
              ))}
              <Chip
                label="An individual"
                selected={schoolId === null}
                onPress={() => setSchoolId(null)}
              />
            </View>
          </View>
        )}

        {/* Only on a vacancy. On a request "you are an individual, not a
            verified school" tells a parent something they already know, and
            the strip above it has already said the part that matters. */}
        {schoolId === null && !isRequest ? (
          <NoticeStrip tone="warning">
            <Text className="text-[11.5px] leading-4 text-mutedForeground">
              This will be shown as posted by an individual, not a verified school. Asking a
              teacher for money to apply will get the listing removed.
            </Text>
          </NoticeStrip>
        ) : (
          <NoticeStrip>
            <Text className="text-[11.5px] leading-4 text-mutedForeground">
              Posted in your school's name. Teachers matching the subjects and county are
              notified, and applicants appear under For schools.
            </Text>
          </NoticeStrip>
        )}

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">
            {isRequest ? 'What do you need?' : 'Role title'}
          </Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={isRequest
              ? 'Maths tutor for Grade 6, twice a week'
              : 'Mathematics Teacher — Form 2 cover'}
            placeholderTextColor={colors.mutedForeground}
            className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
          />
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">Subjects</Text>
          <TextInput
            value={subjects}
            onChangeText={setSubjects}
            placeholder="mathematics, physics"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
          />
          <Text className="text-[10.5px] text-mutedForeground">Separate with commas.</Text>
        </View>

        {/* Full-time / locum is a question about a post. A parent wanting two
            hours on a Tuesday has no answer to it, so it is not asked. */}
        {isRequest ? (
          <>
            <View className="gap-2">
              <Text className="text-[13px] font-medium text-foreground">Where</Text>
              {/*
                Three independent answers, not one choice. The common case is
                a mixture — "online, or I can come to you, but I cannot host" —
                and a single mode could not say it.
              */}
              <View className="gap-1.5">
                <ToggleRow
                  label="Online"
                  hint="Over a video call"
                  value={meetsOnline}
                  onValueChange={setMeetsOnline}
                />
                <ToggleRow
                  label="At our place"
                  hint="The teacher comes to you"
                  value={meetsAtStudent}
                  onValueChange={setMeetsAtStudent}
                />
                <ToggleRow
                  label="At the teacher's place"
                  hint="The learner travels to them"
                  value={meetsAtTeacher}
                  onValueChange={setMeetsAtTeacher}
                />
              </View>
              <TextInput
                value={area}
                onChangeText={setArea}
                placeholder="Area — Kilimani, Nyali, Kikuyu town…"
                placeholderTextColor={colors.mutedForeground}
                maxLength={80}
                className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
              />
              <Text className="text-[10.5px] leading-4 text-mutedForeground">
                The estate or ward only. Teachers use it to work out whether they can get to you.
              </Text>
            </View>

            <View className="gap-2">
              <Text className="text-[13px] font-medium text-foreground">Level</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {TeachingLevel.options.map((l) => (
                  <Chip
                    key={l}
                    label={LEVEL_LABEL[l]}
                    selected={level === l}
                    onPress={() => setLevel(l)}
                  />
                ))}
              </View>
              <Text className="text-[10.5px] leading-4 text-mutedForeground">
                How far along the learner is — not how qualified the teacher must be.
              </Text>
            </View>

            <View className="gap-2">
              <Text className="text-[13px] font-medium text-foreground">You are</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {(['parent', 'student', 'professional'] as const).map((r) => (
                  <Chip
                    key={r}
                    label={POSTER_ROLE_LABEL[r]}
                    selected={posterRole === r}
                    onPress={() => setPosterRole(r)}
                  />
                ))}
              </View>
            </View>

            {/*
              A household may say this; a school may not, and the database
              refuses it there. Phrased as a preference because that is all it
              is — it filters nobody out, it only lets a teacher decide whether
              to bother answering.
            */}
            <View className="gap-2">
              <Text className="text-[13px] font-medium text-foreground">
                Teacher preference (optional)
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {GenderPreference.options.map((g) => (
                  <Chip
                    key={g}
                    label={g === 'any' ? 'No preference' : GENDER_PREFERENCE_LABEL[g]}
                    selected={preferredGender === g}
                    onPress={() => setPreferredGender(g)}
                  />
                ))}
              </View>
              <TextInput
                value={prefersLocality}
                onChangeText={setPrefersLocality}
                placeholder="Prefers teachers from — Kasarani, Westlands…"
                placeholderTextColor={colors.mutedForeground}
                maxLength={80}
                className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
              />
            </View>

            <View className="flex-row gap-2">
              <View className="flex-1 gap-2">
                <Text className="text-[13px] font-medium text-foreground">Learner</Text>
                <TextInput
                  value={learnerLevel}
                  onChangeText={setLearnerLevel}
                  placeholder="Grade 6"
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={60}
                  className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
                />
              </View>
              {/* A one-off assignment happens once; asking how many times a
                  week is a question with no answer. */}
              {engagement === 'assignment' ? null : (
                <View className="flex-1 gap-2">
                  <Text className="text-[13px] font-medium text-foreground">Days a week</Text>
                  <TextInput
                    value={sessions}
                    onChangeText={setSessions}
                    placeholder="2"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="number-pad"
                    maxLength={2}
                    className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
                  />
                </View>
              )}
            </View>
          </>
        ) : (
          <View className="gap-2">
            <Text className="text-[13px] font-medium text-foreground">Type</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {JobType.options.map((t) => (
                <Chip key={t} label={formatLabel(t)} selected={jobType === t} onPress={() => setJobType(t)} />
              ))}
            </View>
          </View>
        )}

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">County</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {County.options.map((c) => (
              <Chip key={c} label={formatLabel(c)} selected={county === c} onPress={() => setCounty(c)} />
            ))}
          </ScrollView>
        </View>

        <Card className="gap-2 px-3.5 py-3">
          <Text className="text-[13px] font-medium text-foreground">
            {isRequest ? 'What you can pay (optional)' : 'Monthly pay (optional)'}
          </Text>
          {isRequest ? (
            <View className="flex-row flex-wrap gap-1.5">
              {RatePeriod.options.map((r) => (
                <Chip
                  key={r}
                  label={r === 'month' ? 'Per month' : r === 'hour' ? 'Per hour' : 'Per session'}
                  selected={ratePeriod === r}
                  onPress={() => setRatePeriod(r)}
                />
              ))}
            </View>
          ) : null}
          <View className="flex-row gap-2">
            <TextInput
              value={salaryMin}
              onChangeText={setSalaryMin}
              placeholder="From"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              className="h-12 flex-1 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
            />
            <TextInput
              value={salaryMax}
              onChangeText={setSalaryMax}
              placeholder="To"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              className="h-12 flex-1 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
            />
          </View>
          <Text className="text-[10.5px] leading-4 text-mutedForeground">
            Stating pay is optional, but a listing without it is skipped by Auto-Apply and reads
            as a worse offer than it may be.
          </Text>
        </Card>

        {error !== null ? <ErrorBanner message={error} /> : null}

        {saving ? (
          <ActivityIndicator color={colors.mutedForeground} className="py-3" />
        ) : (
          <View className="gap-2">
              <Button
              label={isRequest ? 'Post this request' : 'Post this role'}
              disabled={!ready}
              onPress={() => void submit()}
            />
            <WhyDisabled missing={missing} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}
