import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatLabel } from '@mwalimu/core';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@mwalimu/ui';
import type { Tables } from '@mwalimu/types';
import { Chip, EmptyState, ErrorBanner, ScreenHeader } from '../../components/ui';
import { useTabBarClearance } from '../../components/floating-tab-bar';
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

/**
 * File type is identity, not status. Coloured tiles read as severity — a red
 * PDF square looked like a warning — so the extension carries it in ink.
 */

export default function ResourcesScreen() {
  const tabBarClearance = useTabBarClearance();
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
          placeholderTextColor={colors.mutedForeground}
          className="h-11 rounded-md border border-border bg-background px-3 text-[14px] text-foreground"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {KINDS.map((k) => (
            <Chip key={k.key} label={k.label} selected={kind === k.key} onPress={() => setKind(k.key)} />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: tabBarClearance }}
          ListHeaderComponent={error !== null ? <View className="pt-4"><ErrorBanner message={error} /></View> : null}
          ListEmptyComponent={<EmptyState title="Nothing here yet" body="Try another type or search." />}
          renderItem={({ item }) => {
            return (
              <View className="flex-row items-center gap-3 border-b border-border py-2.5">
                <View className="h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <Text className="text-[9px] font-medium text-foreground/70">
                    {item.file_extension.toUpperCase()}
                  </Text>
                </View>
                <View className="min-w-0 flex-1">
                  <Text numberOfLines={1} className="text-[12.5px] font-medium text-foreground">
                    {item.title}
                  </Text>
                  <Text className="mt-0.5 text-[11px] text-mutedForeground">
                    {formatLabel(item.kind)} · {formatFileSize(item.size_bytes)} · {item.download_count} downloads
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Download ${item.title}`}
                  className="h-11 w-11 items-center justify-center rounded-full bg-wash"
                >
                  <Feather name="download" size={17} color={colors.mutedForeground} />
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}
