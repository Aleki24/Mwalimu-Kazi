import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { COMMON_SUBJECTS, County, RatePeriod } from '@mwalimu/types';
import { formatLabel } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import {
  Button, Card, centredContent, Chip, ErrorBanner, NoticeStrip, ToggleRow, WhyDisabled,
} from '../../components/ui';
import { ListEditor } from '../../components/list-editor';
import { useTeacher } from '../../lib/auth';
import { fetchMyTutorProfile, saveTutorProfile } from '../../lib/tutors';

/**
 * Offering private tuition.
 *
 * Off until the teacher turns it on, and off is the only sensible default: a
 * teaching profile exists for everyone who signed up, and quietly listing all
 * of them as available for private work would be advertising a service on
 * their behalf that they never offered.
 *
 * The switch is at the bottom rather than the top on purpose — it is the last
 * thing you do, after you have said what you teach and where.
 */
const input = 'rounded-md border border-border bg-card px-3 py-2.5 text-[14px] text-foreground';

function Field({
  label, value, onChangeText, placeholder, keyboardType, multiline, maxLength, hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad';
  multiline?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-[11.5px] font-medium text-mutedForeground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline ?? false}
        maxLength={maxLength}
        textAlignVertical={multiline === true ? 'top' : 'center'}
        className={`${input} ${multiline === true ? 'min-h-[92px]' : 'h-11'}`}
      />
      {hint === undefined ? null : (
        <Text className="text-[10.5px] leading-4 text-mutedForeground">{hint}</Text>
      )}
    </View>
  );
}

export default function TutoringScreen() {
  const teacher = useTeacher();
  const insets = useSafeAreaInsets();

  const [available, setAvailable] = useState(false);
  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [subjects, setSubjects] = useState<readonly string[]>([]);
  const [levels, setLevels] = useState<readonly string[]>([]);
  const [county, setCounty] = useState<string>(teacher.county);
  const [area, setArea] = useState('');
  const [online, setOnline] = useState(true);
  const [atStudent, setAtStudent] = useState(false);
  const [atMine, setAtMine] = useState(false);
  const [rateMin, setRateMin] = useState('');
  const [rateMax, setRateMax] = useState('');
  const [period, setPeriod] = useState<(typeof RatePeriod.options)[number]>('hour');
  const [gender, setGender] = useState('');

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const row = await fetchMyTutorProfile();
        if (cancelled || row === null) return;
        setAvailable(row.available);
        setHeadline(row.headline ?? '');
        setAbout(row.about ?? '');
        setSubjects(row.subjects);
        setLevels(row.learner_levels);
        setCounty(row.county ?? teacher.county);
        setArea(row.area ?? '');
        setOnline(row.meets_online);
        setAtStudent(row.meets_at_student);
        setAtMine(row.meets_at_teacher);
        setRateMin(row.rate_min === null ? '' : String(row.rate_min));
        setRateMax(row.rate_max === null ? '' : String(row.rate_max));
        setPeriod(row.rate_period);
        setGender(row.gender ?? '');
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load this');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [teacher.county]);

  // Exactly the two things the database refuses to list without, said here so
  // the teacher reads a sentence rather than a constraint violation.
  const missing = [
    ...(subjects.length === 0 ? ['at least one subject'] : []),
    ...(!online && !atStudent && !atMine ? ['at least one way of meeting'] : []),
  ];

  const number = (v: string): number | null => {
    const n = Number.parseInt(v, 10);
    return Number.isInteger(n) && n >= 0 ? n : null;
  };
  const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

  const save = async (nextAvailable: boolean) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await saveTutorProfile({
        user_id: teacher.id,
        available: nextAvailable,
        headline: orNull(headline),
        about: orNull(about),
        subjects: [...subjects],
        learner_levels: [...levels],
        county,
        area: orNull(area),
        meets_online: online,
        meets_at_student: atStudent,
        meets_at_teacher: atMine,
        rate_min: number(rateMin),
        rate_max: number(rateMax),
        rate_period: period,
        gender: orNull(gender),
      });
      setAvailable(nextAvailable);
      setNote(nextAvailable
        ? 'You are listed. Parents searching your subjects and county will find you.'
        : 'Saved, and not listed. Nobody can find you until you switch it on.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save that');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ title: 'Offer tuition' }} />
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Offer tuition' }} />
      <ScrollView
        contentContainerStyle={{
          padding: 16, gap: 14, paddingBottom: insets.bottom + 32, ...centredContent,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <NoticeStrip tone={available ? 'success' : 'neutral'}>
          <Text className="text-[11.5px] leading-4 text-mutedForeground">
            {available
              ? 'You are listed under Find a tutor. Parents can read this and get in touch about a request.'
              : 'Nobody can see this yet. Fill it in, then switch it on at the bottom.'}
          </Text>
        </NoticeStrip>

        <Card className="gap-3 px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">What you offer</Text>
          <Field
            label="One line about you"
            value={headline}
            onChangeText={setHeadline}
            placeholder="Maths and physics, Form 1 to 4"
            maxLength={90}
          />
          <Field
            label="More, if you want"
            value={about}
            onChangeText={setAbout}
            placeholder="How you teach, what you have found works, anything a parent would want to know before writing to you."
            multiline
            maxLength={1200}
          />
          <View className="gap-2">
            <Text className="text-[11.5px] font-medium text-mutedForeground">Subjects</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {COMMON_SUBJECTS.map((s) => (
                <Chip
                  key={s}
                  label={formatLabel(s)}
                  selected={subjects.includes(s)}
                  onPress={() => setSubjects((prev) => (prev.includes(s)
                    ? prev.filter((x) => x !== s)
                    : [...prev, s]))}
                />
              ))}
            </View>
          </View>
          <ListEditor
            label="Learners you take"
            items={levels}
            onChange={setLevels}
            placeholder="Form 1 to 4"
            max={8}
          />
        </Card>

        <Card className="gap-3 px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">Where and how</Text>
          <ToggleRow label="Over a video call" value={online} onValueChange={setOnline} />
          <ToggleRow label="I travel to the learner" value={atStudent} onValueChange={setAtStudent} />
          <ToggleRow label="They come to me" value={atMine} onValueChange={setAtMine} />
          <Field
            label="Area"
            value={area}
            onChangeText={setArea}
            placeholder="Kilimani"
            maxLength={80}
            hint="The estate or ward only. Never your address — that is something you tell a parent in the conversation, once you have both decided."
          />
          <View className="gap-2">
            <Text className="text-[11.5px] font-medium text-mutedForeground">County</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {County.options.map((c) => (
                <Chip key={c} label={formatLabel(c)} selected={county === c} onPress={() => setCounty(c)} />
              ))}
            </ScrollView>
          </View>
        </Card>

        <Card className="gap-3 px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">What you charge</Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Field label="From" value={rateMin} onChangeText={setRateMin} keyboardType="number-pad" placeholder="800" />
            </View>
            <View className="flex-1">
              <Field label="To" value={rateMax} onChangeText={setRateMax} keyboardType="number-pad" placeholder="1200" />
            </View>
          </View>
          <View className="flex-row flex-wrap gap-1.5">
            {RatePeriod.options.map((r) => (
              <Chip key={r} label={`Per ${r}`} selected={period === r} onPress={() => setPeriod(r)} />
            ))}
          </View>
          <Field
            label="Gender (optional)"
            value={gender}
            onChangeText={setGender}
            placeholder="Female"
            maxLength={40}
            hint="Only if you want it shown. Some households ask for a particular teacher, and this is how they find you — but it is yours to give, not ours to read off your CV."
          />
        </Card>

        {error !== null ? <ErrorBanner message={error} /> : null}
        {note === null ? null : (
          <Text className="text-[11.5px] text-successForeground">{note}</Text>
        )}

        {busy ? (
          <ActivityIndicator color={colors.mutedForeground} className="py-2" />
        ) : (
          <View className="gap-2">
            <Button
              label={available ? 'Save changes' : 'List me under Find a tutor'}
              disabled={missing.length > 0}
              onPress={() => void save(true)}
            />
            <WhyDisabled missing={missing} />
            {available ? (
              <Button
                label="Take me off the list"
                variant="secondary"
                onPress={() => void save(false)}
              />
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
