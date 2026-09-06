import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatLabel } from '@mwalimu/core';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@mwalimu/ui';
import type { Tables } from '@mwalimu/types';
import { Chip, EmptyState, ErrorBanner, ScreenHeader } from '../../components/ui';
import { fetchResources, formatFileSize } from '../../lib/content';

type Kind = Tables<'resources'>['kind'];

const KINDS: ReadonlyArray<{ key: Kind | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'notes', label: 'Notes' },
  { key: 'scheme_of_work', label: 'Schemes' },
  { key: 'past_paper', label: 'Past papers' },
  { key: 'lesson_plan', label: 'Lesson plans' },
  { key: 'marking_scheme', label: 'Marking schemes' },
  { key: 'slides', label: 'Slides' },
  { key: 'worksheet', label: 'Worksheets' },
];

/** File-type colour, so the list scans by shape as much as by title. */
const EXT_TONE: Readonly<Record<string, string>> = {
  pdf: 'bg-dangerBg text-danger',
  docx: 'bg-infoBg text-info',
  pptx: 'bg-warningBg text-warning',
};

export default function ResourcesScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<readonly Tables<'resources'>[]>([]);
  const [kind, setKind] = useState<Kind | 'all'>('all');
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setItems(await fetchResources());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load resources');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((r) => {
      if (kind !== 'all' && r.kind !== kind) return false;
      if (q !== '' && !r.title.toLowerCase().includes(q) && !(r.subject ?? '').includes(q)) return false;
      return true;
    });
  }, [items, kind, query]);

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScreenHeader
        title="Resources"
        subtitle={loading ? 'Loading…' : `${items.length} files shared by teachers`}
      />

      <View className="gap-3 border-b border-border bg-card px-4 pb-3 pt-3">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search notes, schemes, past papers…"
          placeholderTextColor={colors.mutedFaint}
          className="h-11 rounded-md border border-border bg-background px-3 text-[14px] text-foreground"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {KINDS.map((k) => (
            <Pressable key={k.key} onPress={() => setKind(k.key)} accessibilityRole="button">
              <Chip label={k.label} selected={kind === k.key} />
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} className="py-10" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ListHeaderComponent={error !== null ? <View className="pt-4"><ErrorBanner message={error} /></View> : null}
          ListEmptyComponent={<EmptyState title="Nothing here yet" body="Try another type or search." />}
          renderItem={({ item }) => {
            const tone = EXT_TONE[item.file_extension] ?? 'bg-mutedBg text-muted';
            const [bg, fg] = tone.split(' ') as [string, string];
            return (
              <View className="flex-row items-center gap-3 border-b border-border py-2.5">
                <View className={`h-10 w-10 items-center justify-center rounded-md ${bg}`}>
                  <Text className={`text-[9px] font-extrabold ${fg}`}>
                    {item.file_extension.toUpperCase()}
                  </Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-[12.5px] font-semibold text-foreground">
                    {item.title}
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-muted">
                    {formatLabel(item.kind)} · {formatFileSize(item.size_bytes)} · {item.download_count} downloads
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Download ${item.title}`}
                  className="h-11 w-11 items-center justify-center rounded-full bg-primarySoft"
                >
                  <Feather name="download" size={17} color={colors.primary} />
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
