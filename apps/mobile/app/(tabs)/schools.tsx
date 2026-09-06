import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatLabel } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { Badge, Chip, EmptyState, ErrorBanner, SchoolMark, ScreenHeader } from '../../components/ui';
import { fetchSchools, type SchoolListing } from '../../lib/schools';
import { useTeacher } from '../../lib/auth';

type Tab = 'all' | 'nearby' | 'hiring';

export default function SchoolsScreen() {
  const insets = useSafeAreaInsets();
  const teacher = useTeacher();
  const [listings, setListings] = useState<readonly SchoolListing[]>([]);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setListings(await fetchSchools());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load schools');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listings.filter((l) => {
      if (tab === 'nearby' && l.school.county !== teacher.county) return false;
      if (tab === 'hiring' && l.openings === 0) return false;
      if (q !== '' && !l.school.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [listings, tab, query, teacher.county]);

  const TABS: ReadonlyArray<{ key: Tab; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'nearby', label: `In ${formatLabel(teacher.county)}` },
    { key: 'hiring', label: 'Hiring now' },
  ];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScreenHeader
        title="Schools"
        subtitle={loading ? 'Loading…' : `${visible.length} of ${listings.length} schools`}
      />

      <View className="gap-3 border-b border-border bg-card px-4 pb-3 pt-3">
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search schools…"
          placeholderTextColor={colors.mutedForeground}
          className="h-11 rounded-md border border-border bg-background px-3 text-[14px] text-foreground"
        />
        <View className="flex-row gap-2">
          {TABS.map((t) => (
            <Chip key={t.key} label={t.label} selected={tab === t.key} onPress={() => setTab(t.key)} />
          ))}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(l) => l.school.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          ListHeaderComponent={error !== null ? <View className="pt-4"><ErrorBanner message={error} /></View> : null}
          ListEmptyComponent={
            <EmptyState title="No schools match" body="Try a different search or tab." />
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: '/school/[slug]', params: { slug: item.school.slug } }} asChild>
              <Pressable accessibilityRole="button">
                <View className="flex-row items-center gap-3 border-b border-border py-3">
                  <SchoolMark name={item.school.name} size={44} />
                  <View className="min-w-0 flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Text numberOfLines={1} className="text-[13.5px] font-medium text-foreground">
                        {item.school.name}
                      </Text>
                      {item.school.verification === 'verified' ? (
                        <Text className="text-[11px] font-medium text-success">✓</Text>
                      ) : null}
                    </View>
                    <Text className="mt-0.5 text-[11.5px] text-mutedForeground">
                      {formatLabel(item.school.school_type)} · {item.school.curricula.map(formatLabel).join(', ')} · {formatLabel(item.school.county)}
                    </Text>
                    <View className="mt-1.5 flex-row items-center gap-2">
                      {item.rating === null ? (
                        <Text className="text-[11px] text-mutedForeground">No reviews yet</Text>
                      ) : (
                        <Text className="text-[11px] font-medium text-foreground">
                          ★ {item.rating.toFixed(1)}{' '}
                          <Text className="font-normal text-mutedForeground">({item.reviewCount})</Text>
                        </Text>
                      )}
                      {item.openings > 0 ? (
                        <Text className="text-[11px] font-medium text-foreground">
                          {item.openings} opening{item.openings === 1 ? '' : 's'}
                        </Text>
                      ) : null}
                      {item.school.verification !== 'verified' ? (
                        <Badge label="Unverified" tone="warning" />
                      ) : null}
                    </View>
                  </View>
                </View>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}
