import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { formatLabel } from '@mwalimu/core';
import { COMMON_SUBJECTS, County } from '@mwalimu/types';
import { colors } from '@mwalimu/ui';
import { Button, centredContent, Chip, ErrorBanner } from '../../components/ui';
import { useAuth, useTeacher } from '../../lib/auth';
import { supabase } from '../../lib/supabase';

/**
 * Edit the profile.
 *
 * Until now these fields were captured once during onboarding and then frozen,
 * which is wrong for the two that change most: a teacher gains a subject, or
 * their TSC number comes through. Both feed the matcher, so a profile that
 * cannot be corrected quietly degrades every match score the app shows.
 */
export default function EditProfileScreen() {
  const teacher = useTeacher();
  const { refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState(teacher.fullName);
  const [headline, setHeadline] = useState(teacher.headline ?? '');
  const [county, setCounty] = useState<County>(teacher.county);
  const [subjects, setSubjects] = useState<readonly string[]>(teacher.subjects);
  const [years, setYears] = useState(String(teacher.experienceYears));
  const [tsc, setTsc] = useState(teacher.tscNumber ?? '');
  const [hasDegree, setHasDegree] = useState(teacher.hasDegree);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsedYears = Number.parseInt(years, 10);
  const yearsValid = Number.isInteger(parsedYears) && parsedYears >= 0 && parsedYears <= 60;
  const ready = fullName.trim().length >= 2 && subjects.length > 0 && yearsValid;

  const toggleSubject = (s: string) =>
    setSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const { error: updateError } = await supabase.from('profiles').update({
        full_name: fullName.trim(),
        headline: headline.trim() === '' ? null : headline.trim(),
        county,
        subjects: [...subjects],
        experience_years: parsedYears,
        // An empty box means "I do not have one", not "leave what was there".
        tsc_number: tsc.trim() === '' ? null : tsc.trim(),
        has_degree: hasDegree,
      }).eq('id', teacher.id);
      if (updateError !== null) throw new Error(updateError.message);

      // Refresh before leaving: the Profile screen behind this one reads the
      // cached teacher, and would otherwise show the old values.
      await refreshProfile();
      if (router.canGoBack()) router.back();
      else router.replace('/profile');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Edit profile' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32, ...centredContent }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">Full name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholderTextColor={colors.mutedForeground}
            className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
          />
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">Headline</Text>
          <TextInput
            value={headline}
            onChangeText={setHeadline}
            placeholder="Mathematics & Physics teacher"
            placeholderTextColor={colors.mutedForeground}
            maxLength={120}
            className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
          />
          <Text className="text-[10.5px] text-mutedForeground">
            Shown under your name on your CV and your posts.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">
            Subjects you teach {subjects.length === 0 ? '— pick at least one' : `(${subjects.length})`}
          </Text>
          <View className="flex-row flex-wrap gap-1.5">
            {[...new Set([...COMMON_SUBJECTS, ...subjects])].map((s) => (
              <Chip
                key={s}
                label={formatLabel(s)}
                selected={subjects.includes(s)}
                onPress={() => toggleSubject(s)}
              />
            ))}
          </View>
          <Text className="text-[10.5px] text-mutedForeground">
            These drive your match scores, so keep them honest rather than broad.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">County</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {County.options.map((c) => (
              <Chip key={c} label={formatLabel(c)} selected={county === c} onPress={() => setCounty(c)} />
            ))}
          </ScrollView>
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">Years teaching</Text>
          <TextInput
            value={years}
            onChangeText={setYears}
            keyboardType="number-pad"
            maxLength={2}
            className="h-12 w-24 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
          />
          {years !== '' && !yearsValid ? (
            <Text className="text-[10.5px] text-destructiveForeground">Enter a number from 0 to 60.</Text>
          ) : null}
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">TSC number</Text>
          <TextInput
            value={tsc}
            onChangeText={setTsc}
            placeholder="Leave blank if you are not registered"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
          />
          <Text className="text-[10.5px] text-mutedForeground">
            Roles that require TSC registration will not match you without this.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">Degree</Text>
          <View className="flex-row gap-1.5">
            <Chip label="I have a degree" selected={hasDegree} onPress={() => setHasDegree(true)} />
            <Chip label="Not yet" selected={!hasDegree} onPress={() => setHasDegree(false)} />
          </View>
        </View>

        {error !== null ? <ErrorBanner message={error} /> : null}

        {saving ? (
          <ActivityIndicator color={colors.mutedForeground} className="py-3" />
        ) : (
          <Button label="Save changes" disabled={!ready} onPress={() => void save()} />
        )}
      </ScrollView>
    </View>
  );
}
