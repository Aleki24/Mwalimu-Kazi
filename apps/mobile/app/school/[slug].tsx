import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {
  formatClosing, formatLabel, formatSalary, RED_FLAG_LABEL, REVIEW_CATEGORY_LABEL,
} from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { Badge, Card, EmptyState, ErrorBanner, SchoolMark, Tag } from '../../components/ui';
import { fetchSchoolBySlug, type SchoolDetail } from '../../lib/schools';

/** A rating bar. Red below 3, amber below 4 — the colour is the summary. */
function CategoryBar({ label, average }: { label: string; average: number }) {
  const tone = average >= 4 ? 'bg-success' : average >= 3 ? 'bg-warning' : 'bg-destructive';
  return (
    <View className="flex-row items-center gap-2.5">
      <Text className="w-[104px] text-[11.5px] text-mutedForeground">{label}</Text>
      <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-wash">
        <View className={`h-full rounded-full ${tone}`} style={{ width: `${(average / 5) * 100}%` }} />
      </View>
      <Text className="w-6 text-right text-[11.5px] font-medium text-foreground">{average.toFixed(1)}</Text>
    </View>
  );
}

/**
 * Both the "no reviews yet" card and the ratings card need this, and they must
 * not drift apart — the empty state is the one a first reviewer sees.
 */
function ReviewLink({
  schoolId, schoolName, label,
}: { schoolId: string; schoolName: string; label: string }) {
  return (
    <Link
      href={{ pathname: '/review/new', params: { schoolId, schoolName } }}
      asChild
    >
      <Pressable accessibilityRole="link" className="mt-3 flex-row items-center gap-1.5">
        <Feather name="edit-3" size={13} color={colors.primary} />
        <Text className="text-[12px] font-medium text-primary">{label}</Text>
      </Pressable>
    </Link>
  );
}

export default function SchoolDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [detail, setDetail] = useState<SchoolDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const found = await fetchSchoolBySlug(slug, now);
        if (!cancelled) setDetail(found);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load this school');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, now]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.mutedForeground} />
      </View>
    );
  }
  if (error !== null) return <View className="flex-1 bg-background p-4"><ErrorBanner message={error} /></View>;
  if (detail === null) {
    return <View className="flex-1 bg-background"><EmptyState title="School not found" body="It may have been removed." /></View>;
  }

  const { school, openings, ratings, redFlags } = detail;
  const verified = school.verification === 'verified';

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: school.name }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        <View className="flex-row items-center gap-3">
          <SchoolMark name={school.name} size={52} />
          <View className="min-w-0 flex-1">
            <Text className="text-[16px] font-medium tracking-tight text-foreground">{school.name}</Text>
            <View className="mt-1 flex-row items-center gap-1.5">
              <Badge
                label={verified ? 'Verified school' : 'Verification pending'}
                tone={verified ? 'success' : 'warning'}
              />
              <Text className="text-[11.5px] text-mutedForeground">{formatLabel(school.county)}</Text>
            </View>
          </View>
        </View>

        <View className="flex-row gap-2.5">
          {[
            ['Openings', String(openings.length)],
            ['Teachers', school.teacher_count === null ? '—' : `${school.teacher_count}`],
            ['Rating', ratings.overall === null ? '—' : ratings.overall.toFixed(1)],
          ].map(([label, value]) => (
            <Card key={label} className="flex-1 p-3">
              <Text className="text-[12px] font-medium text-mutedForeground">{label}</Text>
              <Text className="mt-0.5 text-xl font-medium tracking-tight text-foreground">{value}</Text>
            </Card>
          ))}
        </View>

        {/* Red flags sit above the marketing copy on purpose: it is the thing a
            teacher opened this page to find out. */}
        {redFlags.length > 0 ? (
          <Card className="p-3.5">
            <View className="flex-row items-center gap-2">
              <View className="h-1.5 w-1.5 rounded-full bg-destructive" />
              <Text className="text-sm text-foreground">
                {redFlags.length} open red flag{redFlags.length === 1 ? '' : 's'}
              </Text>
            </View>
            <View className="mt-2 gap-1.5">
              {redFlags.map((flag) => (
                <View key={flag.kind} className="flex-row items-center gap-2">
                  <Text className="flex-1 text-[12px] font-medium text-destructiveForeground">
                    {RED_FLAG_LABEL[flag.kind]}
                  </Text>
                  <Text className="text-[11px] font-medium text-destructiveForeground">
                    {flag.count} report{flag.count === 1 ? '' : 's'}
                  </Text>
                </View>
              ))}
            </View>
            <Text className="mt-2 text-[10.5px] leading-4 text-mutedForeground">
              Each report is reviewed by a moderator before it appears, and the school can respond.
            </Text>
          </Card>
        ) : null}

        {ratings.overall !== null ? (
          <Card className="p-3.5">
            <Text className="mb-2.5 text-[12.5px] font-medium text-foreground">
              What {ratings.reviewCount} teacher{ratings.reviewCount === 1 ? '' : 's'} said
            </Text>
            <View className="gap-1.5">
              {ratings.byCategory.slice(0, 5).map((c) => (
                <CategoryBar key={c.category} label={REVIEW_CATEGORY_LABEL[c.category]} average={c.average} />
              ))}
            </View>
            <ReviewLink schoolId={school.id} schoolName={school.name} label="Add your review" />
          </Card>
        ) : (
          <Card className="p-3.5">
            <Text className="text-[12.5px] font-medium text-foreground">No reviews yet</Text>
            <Text className="mt-1 text-[11.5px] leading-4 text-mutedForeground">
              Taught here? A review from verified staff is what makes this page worth reading.
            </Text>
            <ReviewLink schoolId={school.id} schoolName={school.name} label="Write the first review" />
          </Card>
        )}

        {school.about !== null ? (
          <Card className="p-3.5">
            <Text className="mb-1.5 text-[12.5px] font-medium text-foreground">About</Text>
            <Text className="text-[12px] leading-5 text-mutedForeground">{school.about}</Text>
            {school.facilities.length > 0 ? (
              <View className="mt-2.5 flex-row flex-wrap gap-1.5">
                {school.facilities.map((f) => <Tag key={f} label={f} />)}
              </View>
            ) : null}
          </Card>
        ) : null}

        {openings.length > 0 ? (
          <Card className="p-3.5">
            <Text className="mb-1.5 text-[12.5px] font-medium text-foreground">
              Open roles ({openings.length})
            </Text>
            {openings.map((job) => {
              const closing = formatClosing(job.closes_at === null ? undefined : new Date(job.closes_at), now);
              return (
                // Listing a vacancy and then not opening it is the page
                // failing at the only thing the reader came for.
                <Link key={job.id} href={{ pathname: '/job/[id]', params: { id: job.id } }} asChild>
                  <Pressable
                    accessibilityRole="link"
                    className="flex-row items-center gap-2 border-t border-border py-2.5"
                  >
                    <View className="min-w-0 flex-1">
                      <Text className="text-[12.5px] font-medium text-foreground">{job.title}</Text>
                      <Text className="mt-0.5 text-[11px] text-mutedForeground">
                        {formatSalary(
                          job.salary_min === null ? undefined : {
                            min: job.salary_min,
                            ...(job.salary_max === null ? {} : { max: job.salary_max }),
                          },
                        )}
                        {closing === null ? '' : ` · ${closing}`}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
                  </Pressable>
                </Link>
              );
            })}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
}
