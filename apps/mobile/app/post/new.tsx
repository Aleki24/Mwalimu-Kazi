import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { County, JobType } from '@mwalimu/types';
import { formatLabel } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { Button, Card, Chip, ErrorBanner, NoticeStrip } from '../../components/ui';
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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  const subjectList = subjects.split(',').map((s) => s.trim().toLowerCase()).filter((s) => s !== '');
  const ready = title.trim().length >= 3 && subjectList.length > 0;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await postJob({
        schoolId,
        title: title.trim(),
        county,
        subjects: subjectList,
        jobType,
        salaryMin: salaryMin.trim() === '' ? null : Number(salaryMin),
        salaryMax: salaryMax.trim() === '' ? null : Number(salaryMax),
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
        <Text className="text-center text-[15px] font-medium text-foreground">Your role is live</Text>
        <Text className="text-center text-[12.5px] leading-5 text-mutedForeground">
          {schoolId === null
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
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {schools.length === 0 ? null : (
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

        {schoolId === null ? (
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
          <Text className="text-[13px] font-medium text-foreground">Role title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Mathematics Teacher — Form 2 cover"
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

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">Type</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {JobType.options.map((t) => (
              <Chip key={t} label={formatLabel(t)} selected={jobType === t} onPress={() => setJobType(t)} />
            ))}
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">County</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {County.options.map((c) => (
              <Chip key={c} label={formatLabel(c)} selected={county === c} onPress={() => setCounty(c)} />
            ))}
          </ScrollView>
        </View>

        <Card className="gap-2 px-3.5 py-3">
          <Text className="text-[13px] font-medium text-foreground">Monthly pay (optional)</Text>
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
          <Button label="Post this role" disabled={!ready} onPress={() => void submit()} />
        )}
      </ScrollView>
    </View>
  );
}
