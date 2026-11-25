import { useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { formatLabel } from '@mwalimu/core';
import { colors, radius } from '@mwalimu/ui';
import {
  AccountRole, COMMON_SUBJECTS, County, ParentProfile, TeacherProfile,
} from '@mwalimu/types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Card, centredContent, Chip } from '../../components/ui';

/**
 * The first thing the app asks, and the first thing it got wrong.
 *
 * Every account used to be a teacher's. A parent who came here to find a maths
 * tutor for their daughter was asked which subjects they teach, how many years
 * they have been in a classroom, and for their TSC number — and could not get
 * past the form without answering. The product has had a parent half since
 * tuition requests shipped; the front door never knew.
 *
 * So the first screen is one question with two answers, and the two paths
 * ask for completely different things: a teacher is describing what they can
 * be hired for, a parent is telling us roughly where they are so we can show
 * them tutors who could actually reach their child.
 */

/** Counties surfaced first; the rest follow alphabetically. */
const PROMINENT = ['nairobi', 'kiambu', 'mombasa', 'kisumu', 'nakuru', 'machakos'] as const;

const EXPERIENCE_BANDS = [
  { label: 'Under 1 year', years: 0 },
  { label: '1–2 years', years: 1 },
  { label: '3–5 years', years: 3 },
  { label: '5+ years', years: 5 },
] as const;

const ROLES = [
  {
    role: 'teacher',
    icon: 'briefcase',
    title: 'I am a teacher',
    body: 'Find roles and tuition work, build one CV, and apply with it.',
  },
  {
    role: 'parent',
    icon: 'home',
    title: 'I am a parent or guardian',
    body: 'Find a tutor for your child, or post what you need and let teachers answer.',
  },
] as const satisfies ReadonlyArray<{
  role: AccountRole;
  icon: React.ComponentProps<typeof Feather>['name'];
  title: string;
  body: string;
}>;

const field = 'h-12 rounded-lg border border-border bg-card px-3.5 text-[15px] text-foreground';

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { session, refreshProfile, signOut } = useAuth();

  const [role, setRole] = useState<AccountRole | null>(null);
  const [fullName, setFullName] = useState('');
  const [county, setCounty] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<ReadonlySet<string>>(new Set());
  const [experienceYears, setExperienceYears] = useState<number | null>(null);
  const [hasDegree, setHasDegree] = useState(false);
  const [tscNumber, setTscNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const counties = useMemo(() => {
    const rest = County.options.filter((c) => !PROMINENT.includes(c as (typeof PROMINENT)[number]));
    return [...PROMINENT, ...rest];
  }, []);

  const toggleSubject = (slug: string) =>
    setSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });

  const named = fullName.trim().length >= 2 && county !== null;
  const complete = role === 'parent'
    ? named
    : named && subjects.size > 0 && experienceYears !== null;

  /**
   * A parent's row, which is four columns and no claims.
   *
   * `open_to_opportunities` is false on purpose. It means "schools may find
   * me", it defaults to true, and a parent is not looking to be found by a
   * school. The policy added with the role column refuses those reads anyway;
   * this keeps the row itself honest rather than relying on the guard.
   */
  const saveParent = async (userId: string) => {
    const candidate = ParentProfile.safeParse({
      id: userId,
      fullName: fullName.trim(),
      county,
      notificationSound: false,
    });
    if (!candidate.success) {
      return candidate.error.issues[0]?.message ?? 'Please check your details';
    }
    const p = candidate.data;
    const { error: insertError } = await supabase.from('profiles').insert({
      id: p.id,
      full_name: p.fullName,
      county: p.county,
      role: 'parent',
      open_to_opportunities: false,
    });
    return insertError?.message ?? null;
  };

  const saveTeacher = async (userId: string) => {
    // Validate against the domain schema before the insert, so a bad value is a
    // readable message rather than a Postgres constraint error.
    const candidate = TeacherProfile.safeParse({
      id: userId,
      fullName: fullName.trim(),
      county,
      subjects: [...subjects],
      curricula: [],
      experienceYears,
      hasDegree,
      tscNumber: tscNumber.trim() === '' ? undefined : tscNumber.trim(),
      tscVerified: false,
      openToOpportunities: true,
      skills: [],
    });
    if (!candidate.success) {
      return candidate.error.issues[0]?.message ?? 'Please check your details';
    }
    const p = candidate.data;
    const { error: insertError } = await supabase.from('profiles').insert({
      id: p.id,
      full_name: p.fullName,
      county: p.county,
      role: 'teacher',
      subjects: p.subjects,
      curricula: p.curricula,
      experience_years: p.experienceYears,
      has_degree: p.hasDegree,
      // Never trusted from the client — a background check sets tsc_verified.
      tsc_number: p.tscNumber ?? null,
      open_to_opportunities: p.openToOpportunities,
      skills: p.skills,
    });
    return insertError?.message ?? null;
  };

  const save = async () => {
    const userId = session?.user.id;
    if (userId === undefined || role === null || !complete) return;

    setSaving(true);
    setError(null);
    const failure = role === 'parent' ? await saveParent(userId) : await saveTeacher(userId);
    setSaving(false);
    if (failure !== null) {
      setError(failure);
      return;
    }
    await refreshProfile();
  };

  if (role === null) {
    return (
      <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40, ...centredContent }}>
          <View className="pt-6">
            <Text className="text-[28px] font-medium leading-9 tracking-tight text-foreground">
              Welcome to Mwalimu Kazi
            </Text>
            <Text className="mt-2 text-[15px] leading-[22px] text-mutedForeground">
              Which of these are you? It decides what the app shows you, and you only answer it once.
            </Text>
          </View>

          {ROLES.map((option) => (
            <Pressable
              key={option.role}
              accessibilityRole="button"
              accessibilityLabel={option.title}
              onPress={() => setRole(option.role)}
            >
              <Card className="flex-row items-center gap-3.5 p-4">
                <View
                  style={{ borderRadius: radius.xl2 }}
                  className="h-12 w-12 items-center justify-center bg-primarySurface"
                >
                  <Feather name={option.icon} size={20} color={colors.primary} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-[16px] font-medium tracking-tight text-foreground">
                    {option.title}
                  </Text>
                  <Text className="mt-1 text-[12.5px] leading-[18px] text-mutedForeground">
                    {option.body}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </Card>
            </Pressable>
          ))}

          <Pressable
            accessibilityRole="button"
            onPress={() => void signOut()}
            className="min-h-[44px] items-center justify-center"
          >
            <Text className="text-[13px] font-medium text-mutedForeground">Sign out</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const parent = role === 'parent';

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 40, ...centredContent }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to choosing who you are"
          onPress={() => { setRole(null); setError(null); }}
          className="min-h-[44px] flex-row items-center gap-1.5 self-start"
        >
          <Feather name="chevron-left" size={16} color={colors.mutedForeground} />
          <Text className="text-[13px] font-medium text-mutedForeground">
            {parent ? 'I am a parent or guardian' : 'I am a teacher'}
          </Text>
        </Pressable>

        <View>
          <Text className="text-2xl font-medium tracking-tight text-foreground">
            {parent ? 'Just two things' : 'Tell us about your teaching'}
          </Text>
          <Text className="mt-1.5 text-[14px] leading-5 text-mutedForeground">
            {parent
              ? 'Enough to show you tutors who can actually reach your child. Nothing about you is shown to them until you ask for help.'
              : 'This is what we match jobs against, and what schools see when they search.'}
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">Full name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Alex Otieno"
            placeholderTextColor={colors.disabledForeground}
            autoComplete="name"
            className={field}
          />
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">
            {parent ? 'Where you are' : 'County'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {counties.map((c) => (
              <Chip
                key={c}
                label={formatLabel(c)}
                selected={county === c}
                onPress={() => setCounty(c)}
              />
            ))}
          </ScrollView>
        </View>

        {parent ? null : (
          <>
            <View className="gap-2">
              <Text className="text-[13px] font-medium text-foreground">
                Subjects you teach{subjects.size > 0 ? ` (${subjects.size})` : ''}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {COMMON_SUBJECTS.map((s) => (
                  <Chip
                    key={s}
                    label={formatLabel(s)}
                    selected={subjects.has(s)}
                    onPress={() => toggleSubject(s)}
                  />
                ))}
              </View>
            </View>

            <View className="gap-2">
              <Text className="text-[13px] font-medium text-foreground">Teaching experience</Text>
              <View className="flex-row flex-wrap gap-2">
                {EXPERIENCE_BANDS.map((band) => (
                  <Chip
                    key={band.label}
                    label={band.label}
                    selected={experienceYears === band.years}
                    onPress={() => setExperienceYears(band.years)}
                  />
                ))}
              </View>
            </View>

            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: hasDegree }}
              onPress={() => setHasDegree((v) => !v)}
              style={{ borderRadius: radius.lg }}
              className="min-h-[44px] flex-row items-center gap-3 border border-border bg-card px-3.5 py-2"
            >
              <View
                className={`h-6 w-6 items-center justify-center rounded border ${
                  hasDegree ? 'border-foreground bg-foreground' : 'border-border bg-card'
                }`}
              >
                {hasDegree ? <Text className="text-xs text-card">✓</Text> : null}
              </View>
              <Text className="flex-1 text-[14px] text-foreground">
                I have a degree in Education or my subject
              </Text>
            </Pressable>

            <View className="gap-2">
              <Text className="text-[13px] font-medium text-foreground">TSC number (optional)</Text>
              <TextInput
                value={tscNumber}
                onChangeText={setTscNumber}
                placeholder="123456"
                placeholderTextColor={colors.disabledForeground}
                keyboardType="number-pad"
                className={field}
              />
              <Text className="text-[11.5px] text-mutedForeground">
                Adding it now means TSC-only roles match you. We verify it separately.
              </Text>
            </View>
          </>
        )}

        {error !== null ? <Text className="text-[13px] text-destructiveForeground">{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !complete || saving }}
          disabled={!complete || saving}
          onPress={() => void save()}
          style={{ borderRadius: radius.pill }}
          className={`h-14 items-center justify-center ${
            complete && !saving ? 'bg-primary' : 'bg-secondary'
          }`}
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text
              className={`text-[15px] font-medium ${
                complete ? 'text-primaryForeground' : 'text-disabledForeground'
              }`}
            >
              {parent ? 'Start finding a tutor' : 'Find me work'}
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          className="min-h-[44px] items-center justify-center"
        >
          <Text className="text-[13px] font-medium text-mutedForeground">Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
