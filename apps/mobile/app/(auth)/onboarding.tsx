import { useMemo, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatLabel } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { COMMON_SUBJECTS, County, TeacherProfile } from '@mwalimu/types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { Chip } from '../../components/ui';

/** Counties surfaced first; the rest follow alphabetically. */
const PROMINENT = ['nairobi', 'kiambu', 'mombasa', 'kisumu', 'nakuru', 'machakos'] as const;

const EXPERIENCE_BANDS = [
  { label: 'Under 1 year', years: 0 },
  { label: '1–2 years', years: 1 },
  { label: '3–5 years', years: 3 },
  { label: '5+ years', years: 5 },
] as const;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { session, refreshProfile, signOut } = useAuth();

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

  const complete =
    fullName.trim().length >= 2 && county !== null && subjects.size > 0 && experienceYears !== null;

  const save = async () => {
    const userId = session?.user.id;
    if (userId === undefined || !complete) return;

    setSaving(true);
    setError(null);

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
      setSaving(false);
      setError(candidate.error.issues[0]?.message ?? 'Please check your details');
      return;
    }

    const p = candidate.data;
    const { error: insertError } = await supabase.from('profiles').insert({
      id: p.id,
      full_name: p.fullName,
      county: p.county,
      subjects: p.subjects,
      curricula: p.curricula,
      experience_years: p.experienceYears,
      has_degree: p.hasDegree,
      // Never trusted from the client — a background check sets tsc_verified.
      tsc_number: p.tscNumber ?? null,
      open_to_opportunities: p.openToOpportunities,
      skills: p.skills,
    });

    setSaving(false);
    if (insertError !== null) {
      setError(insertError.message);
      return;
    }
    await refreshProfile();
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 40 }}>
        <View>
          <Text className="text-2xl font-extrabold tracking-tight text-foreground">
            Tell us about your teaching
          </Text>
          <Text className="mt-1.5 text-[14px] leading-5 text-muted">
            This is what we match jobs against, and what schools see when they search.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-bold text-foreground">Full name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Alex Otieno"
            placeholderTextColor={colors.mutedFaint}
            autoComplete="name"
            className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
          />
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-bold text-foreground">County</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {counties.map((c) => (
              <Pressable key={c} onPress={() => setCounty(c)} accessibilityRole="button">
                <Chip label={formatLabel(c)} selected={county === c} />
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-bold text-foreground">
            Subjects you teach{subjects.size > 0 ? ` (${subjects.size})` : ''}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {COMMON_SUBJECTS.map((s) => (
              <Pressable key={s} onPress={() => toggleSubject(s)} accessibilityRole="button">
                <Chip label={formatLabel(s)} selected={subjects.has(s)} />
              </Pressable>
            ))}
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-bold text-foreground">Teaching experience</Text>
          <View className="flex-row flex-wrap gap-2">
            {EXPERIENCE_BANDS.map((band) => (
              <Pressable key={band.label} onPress={() => setExperienceYears(band.years)} accessibilityRole="button">
                <Chip label={band.label} selected={experienceYears === band.years} />
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: hasDegree }}
          onPress={() => setHasDegree((v) => !v)}
          className="min-h-[44px] flex-row items-center gap-3 rounded-md border border-border bg-card px-3.5 py-2"
        >
          <View
            className={`h-6 w-6 items-center justify-center rounded border ${
              hasDegree ? 'border-primary bg-primary' : 'border-border bg-card'
            }`}
          >
            {hasDegree ? <Text className="text-xs font-bold text-white">✓</Text> : null}
          </View>
          <Text className="flex-1 text-[14px] text-foreground">
            I have a degree in Education or my subject
          </Text>
        </Pressable>

        <View className="gap-2">
          <Text className="text-[13px] font-bold text-foreground">TSC number (optional)</Text>
          <TextInput
            value={tscNumber}
            onChangeText={setTscNumber}
            placeholder="123456"
            placeholderTextColor={colors.mutedFaint}
            keyboardType="number-pad"
            className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
          />
          <Text className="text-[11.5px] text-muted">
            Adding it now means TSC-only roles match you. We verify it separately.
          </Text>
        </View>

        {error !== null ? <Text className="text-[13px] text-danger">{error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={!complete || saving}
          onPress={() => void save()}
          className={`h-14 items-center justify-center rounded-md ${
            complete && !saving ? 'bg-primary' : 'bg-mutedBg'
          }`}
        >
          {saving ? (
            <ActivityIndicator color={colors.muted} />
          ) : (
            <Text className={`text-base font-semibold ${complete ? 'text-white' : 'text-muted'}`}>
              Start finding jobs
            </Text>
          )}
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => void signOut()} className="h-11 justify-center">
          <Text className="text-center text-[13px] font-semibold text-muted">Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
