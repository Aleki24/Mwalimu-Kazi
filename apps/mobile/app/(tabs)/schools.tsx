import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Link } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatLabel } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import Feather from '@expo/vector-icons/Feather';
import {
  Badge, Card, centredContent, Chip, EmptyState, ErrorBanner, SchoolMark, ScreenHeader,
  tabularNums,
} from '../../components/ui';
import { useTabBarClearance } from '../../components/floating-tab-bar';
import { fetchSchools, type SchoolListing } from '../../lib/schools';
import { useTeacher } from '../../lib/auth';

type Tab = 'all' | 'nearby' | 'hiring';

export default function SchoolsScreen() {
  const tabBarClearance = useTabBarClearance();
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

      <View className="border-b border-border bg-card">
      <View style={centredContent} className="gap-3 px-4 pb-3 pt-3">
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
      </View>

      {loading ? (
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(l) => l.school.id}
          contentContainerStyle={{
            paddingHorizontal: 16, paddingTop: 12, gap: 10,
            paddingBottom: tabBarClearance, ...centredContent,
          }}
          ListHeaderComponent={error !== null ? <View className="pt-4"><ErrorBanner message={error} /></View> : null}
          ListEmptyComponent={
            <EmptyState title="No schools match" body="Try a different search or tab." />
          }
          renderItem={({ item }) => (
            <Link href={{ pathname: '/school/[slug]', params: { slug: item.school.slug } }} asChild>
              <Pressable accessibilityRole="link">
                <Card className="flex-row items-center gap-3 p-3">
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
                    {/*
                      Every row used to spend its most valuable line saying "No
                      reviews yet", seven times down the screen. The line is now
                      whichever of these is actually true, with the red flags
                      first: a teacher scanning the directory stops for those,
                      not for a star.
                    */}
                    <View className="mt-1.5 flex-row flex-wrap items-center gap-x-2 gap-y-1">
                      {item.redFlagCount > 0 ? (
                        <View className="flex-row items-center gap-1">
                          <Feather name="flag" size={10} color={colors.destructiveForeground} />
                          <Text className="text-[11px] font-medium text-destructiveForeground">
                            {item.redFlagCount} red flag{item.redFlagCount === 1 ? '' : 's'}
                          </Text>
                        </View>
                      ) : null}
                      {item.rating === null ? null : (
                        <Text style={tabularNums} className="text-[11px] font-medium text-foreground">
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
                      {item.rating === null && item.openings === 0
                        && item.school.verification === 'verified' ? (
                          <Text className="text-[11px] text-mutedForeground">No reviews yet</Text>
                        ) : null}
                    </View>
                  </View>
                </Card>
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}
