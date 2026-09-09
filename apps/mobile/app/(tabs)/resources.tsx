import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, Linking, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatLabel } from '@mwalimu/core';
import Feather from '@expo/vector-icons/Feather';
import { colors, radius } from '@mwalimu/ui';
import type { Tables } from '@mwalimu/types';
import {
  Card, centredContent, Chip, EmptyState, ErrorBanner, ScreenHeader,
} from '../../components/ui';
import { useTabBarClearance } from '../../components/floating-tab-bar';
import { fetchResources, formatFileSize, resourceDownloadUrl } from '../../lib/content';

type Kind = Tables<'resources'>['kind'];

/**
 * Filters are derived from what is on the shelf, not from the enum.
 *
 * The fixed list offered Notes, Past papers, Slides and Worksheets when the
 * catalogue held none of them: four chips whose only outcome was an empty
 * state. A filter that cannot match anything is a dead end wearing the same
 * clothes as a working one.
 */
function kindChips(
  items: readonly Tables<'resources'>[],
): ReadonlyArray<{ key: Kind | 'all'; label: string }> {
  const present = [...new Set(items.map((r) => r.kind))].sort();
  return [
    { key: 'all' as const, label: 'All' },
    ...present.map((k) => ({ key: k, label: formatLabel(k) })),
  ];
}

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
  const [busy, setBusy] = useState<string | null>(null);
  // Off the full catalogue, not the filtered view, so choosing one kind does
  // not remove the chips for the others.
  const chips = useMemo(() => kindChips(items), [items]);

  /*
    Handing the file over, rather than fetching it into the app: on web the
    signed URL is a download the browser owns, and on a device it opens in
    whatever already reads PDFs and Word files. Either way the teacher ends up
    with the document where they expect it.
  */
  const download = async (resource: Tables<'resources'>) => {
    setBusy(resource.id);
    try {
      const url = await resourceDownloadUrl(resource);
      await Linking.openURL(url);
      // The count lives on the row, so reflect it without a round trip.
      setItems((prev) => prev.map((r) =>
        r.id === resource.id ? { ...r, download_count: r.download_count + 1 } : r));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That download did not start');
    } finally {
      setBusy(null);
    }
  };

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
        subtitle={loading ? 'Loading…' : `${items.length} files`}
      />

      <View className="gap-3 border-b border-border bg-card px-4 pb-3 pt-3">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search the library…"
          placeholderTextColor={colors.mutedForeground}
          className="h-11 rounded-md border border-border bg-background px-3 text-[14px] text-foreground"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {chips.map((k) => (
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
          contentContainerStyle={{
            paddingHorizontal: 16, paddingTop: 12, gap: 10,
            paddingBottom: tabBarClearance, ...centredContent,
          }}
          ListHeaderComponent={error !== null ? <View className="pt-4"><ErrorBanner message={error} /></View> : null}
          ListEmptyComponent={<EmptyState title="Nothing here yet" body="Try another type or search." />}
          renderItem={({ item }) => (
            <Card className="flex-row items-center gap-3 p-3">
              <View
                style={{ borderRadius: radius.md, borderCurve: 'continuous' }}
                className="h-10 w-10 items-center justify-center bg-primarySurface"
              >
                <Text className="text-[9px] font-medium text-primary">
                  {item.file_extension.toUpperCase()}
                </Text>
              </View>
              <View className="min-w-0 flex-1">
                <Text numberOfLines={2} className="text-[12.5px] font-medium text-foreground">
                  {item.title}
                </Text>
                {/*
                  The extension is here rather than only in the icon because the
                  same template exists as a Word file to type into and a PDF to
                  print, and which one you want is the whole decision.

                  Downloads are only shown once there are some: "0 downloads" on
                  every row is noise, and the fabricated counts this catalogue
                  used to carry were worse than noise.
                */}
                <Text className="mt-0.5 text-[11px] text-mutedForeground">
                  {formatLabel(item.kind)} · {item.file_extension.toUpperCase()}
                  {' · '}{formatFileSize(item.size_bytes)}
                  {item.download_count === 0 ? '' : ` · ${item.download_count} downloads`}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Download ${item.title}`}
                disabled={busy === item.id}
                onPress={() => void download(item)}
                style={{ borderRadius: 999 }}
                className="h-11 w-11 items-center justify-center bg-wash"
              >
                {busy === item.id ? (
                  <ActivityIndicator size="small" color={colors.mutedForeground} />
                ) : (
                  <Feather name="download" size={17} color={colors.primary} />
                )}
              </Pressable>
            </Card>
          )}
        />
      )}
    </View>
  );
}
