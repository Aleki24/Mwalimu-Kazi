import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { COMMON_SUBJECTS, County } from '@mwalimu/types';
import { formatLabel } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import {
  centredContent, Chip, EmptyState, ErrorBanner, NoticeStrip,
} from '../../components/ui';
import { TutorCard } from '../../components/tutor-card';
import { findTutors, type Tutor, type TutorFilter } from '../../lib/tutors';

/**
 * Teachers offering private tuition.
 *
 * The half of this market that did not exist. A parent could post a request
 * and wait; they could not go and look. Now they can, and a teacher who tutors
 * is findable instead of dependent on somebody else happening to post the
 * right thing.
 *
 * Every row comes from `find_tutors`, which returns a card and not a profile —
 * a parent browsing for a maths tutor has no business reading a stranger's TSC
 * number.
 */
export default function TutorsScreen() {
  const [tutors, setTutors] = useState<readonly Tutor[]>([]);
  const [filter, setFilter] = useState<TutorFilter>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (next: TutorFilter) => {
    setLoading(true);
    try {
      setTutors(await findTutors(next));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load tutors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(filter); }, [load, filter]);

  // Typing filters on the server; a debounce keeps that to one request per
  // pause rather than one per letter.
  useEffect(() => {
    const id = setTimeout(() => {
      setFilter((f) => (f.search === search ? f : { ...f, search }));
    }, 350);
    return () => clearTimeout(id);
  }, [search]);

  const toggle = <K extends keyof TutorFilter>(key: K, value: TutorFilter[K]) =>
    setFilter((f) => (f[key] === value ? { ...f, [key]: undefined } : { ...f, [key]: value }));

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Find a tutor' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, ...centredContent }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row items-center gap-2 rounded-md border border-border bg-card px-3">
          <Feather name="search" size={15} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="A subject, a name, an estate"
            placeholderTextColor={colors.mutedForeground}
            className="h-11 min-w-0 flex-1 text-[14px] text-foreground"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip
            label="Online"
            selected={filter.online === true}
            onPress={() => toggle('online', true)}
          />
          <Chip
            label="Comes to you"
            selected={filter.atStudent === true}
            onPress={() => toggle('atStudent', true)}
          />
          {COMMON_SUBJECTS.slice(0, 8).map((s) => (
            <Chip
              key={s}
              label={formatLabel(s)}
              selected={filter.subject === s}
              onPress={() => toggle('subject', s)}
            />
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {County.options.map((c) => (
            <Chip
              key={c}
              label={formatLabel(c)}
              selected={filter.county === c}
              onPress={() => toggle('county', c)}
            />
          ))}
        </ScrollView>

        {error !== null ? <ErrorBanner message={error} /> : null}

        {loading ? (
          <ActivityIndicator color={colors.mutedForeground} className="py-10" />
        ) : tutors.length === 0 ? (
          <>
            <EmptyState
              title="No tutors here yet"
              body="Nobody matching that is offering private tuition. Post what you need instead and teachers who match will see it."
            />
            <Link href="/post/new" asChild>
              <Pressable
                accessibilityRole="link"
                className="flex-row items-center justify-center gap-1.5 py-2"
              >
                <Feather name="plus" size={14} color={colors.primary} />
                <Text className="text-[12.5px] font-medium text-primary">Post a request</Text>
              </Pressable>
            </Link>
          </>
        ) : (
          <>
            <NoticeStrip>
              <Text className="text-[11.5px] leading-4 text-mutedForeground">
                These are teachers who chose to be listed. Nobody here has been vetted beyond the
                TSC check — talk first, and never send money to secure a tutor.
              </Text>
            </NoticeStrip>
            {tutors.map((t) => (
              <Link key={t.userId} href={{ pathname: '/tutors/[id]', params: { id: t.userId } }} asChild>
                <Pressable accessibilityRole="link">
                  <TutorCard tutor={t} />
                </Pressable>
              </Link>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
