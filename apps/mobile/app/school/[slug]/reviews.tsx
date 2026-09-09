import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {
  RED_FLAG_LABEL, REVIEW_CATEGORY_LABEL, formatPostedAge,
} from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import {
  Card, centredContent, EmptyState, ErrorBanner, StatusBadge, Tag,
} from '../../../components/ui';
import { fetchSchoolBySlug, type SchoolDetail } from '../../../lib/schools';

/**
 * Everything teachers said about one school.
 *
 * The school page shows the top five category bars and stops, which is enough
 * to form an impression and not enough to check one. This is the page that
 * lets a teacher read the reviews themselves before deciding whether to send
 * their documents somewhere.
 *
 * No author names, ever — not even initials. The whole reason a teacher will
 * write honestly here is that the school cannot work out who did.
 */

function CategoryBar({ label, average }: { label: string; average: number }) {
  const tone = average >= 4 ? 'bg-success' : average >= 3 ? 'bg-warning' : 'bg-destructive';
  return (
    <View className="flex-row items-center gap-2.5">
      <Text className="w-[112px] text-[11.5px] text-mutedForeground">{label}</Text>
      <View className="h-1.5 flex-1 overflow-hidden rounded-full bg-wash">
        <View className={`h-full rounded-full ${tone}`} style={{ width: `${(average / 5) * 100}%` }} />
      </View>
      <Text
        style={{ fontVariant: ['tabular-nums'] }}
        className="w-6 text-right text-[11.5px] font-medium text-foreground"
      >
        {average.toFixed(1)}
      </Text>
    </View>
  );
}

export default function SchoolReviewsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [detail, setDetail] = useState<SchoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchSchoolBySlug(slug, now);
        if (!cancelled) setDetail(next);
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Could not load these reviews');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, now]);

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      </View>
    );
  }

  if (detail === null) {
    return (
      <View className="flex-1 bg-background p-4">
        <Stack.Screen options={{ title: 'Reviews' }} />
        <ErrorBanner message={error ?? 'That school is no longer here.'} />
      </View>
    );
  }

  const { school, ratings, redFlags, written } = detail;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: school.name }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, ...centredContent }}>
        {written.length === 0 ? (
          <EmptyState
            title="No reviews yet"
            body="Nobody has written about this school. If you have taught here, yours would be the first — and the one every teacher after you reads."
          />
        ) : (
          <>
            <Card className="gap-2.5 p-3.5">
              <View className="flex-row items-baseline gap-2">
                <Text
                  style={{ fontVariant: ['tabular-nums'] }}
                  className="text-[26px] font-medium tracking-tight text-foreground"
                >
                  {ratings.overall === null ? '—' : ratings.overall.toFixed(1)}
                </Text>
                <Text className="text-[12px] text-mutedForeground">
                  from {ratings.reviewCount} review{ratings.reviewCount === 1 ? '' : 's'}
                </Text>
              </View>
              {/* Every category, not the top five: a school that scores well on
                  resources and badly on pay should not be able to hide the
                  second behind the first. */}
              <View className="mt-1 gap-1.5">
                {ratings.byCategory.map((c) => (
                  <CategoryBar
                    key={c.category}
                    label={REVIEW_CATEGORY_LABEL[c.category]}
                    average={c.average}
                  />
                ))}
              </View>
            </Card>

            {redFlags.length > 0 ? (
              <Card className="gap-2 p-3.5">
                <Text className="text-[12.5px] font-medium text-foreground">
                  Open red flags
                </Text>
                {redFlags.map((flag) => (
                  <View key={flag.kind} className="flex-row items-center gap-2">
                    <Feather name="flag" size={11} color={colors.destructiveForeground} />
                    <Text className="flex-1 text-[12px] font-medium text-destructiveForeground">
                      {RED_FLAG_LABEL[flag.kind]}
                    </Text>
                    <Text className="text-[11px] font-medium text-destructiveForeground">
                      {flag.count} report{flag.count === 1 ? '' : 's'}
                    </Text>
                  </View>
                ))}
                <Text className="mt-0.5 text-[10.5px] leading-4 text-mutedForeground">
                  A moderator reads every report before it appears here, and the school can respond.
                </Text>
              </Card>
            ) : null}

            {written.map((review) => (
              <Card key={review.id} className="gap-2 p-3.5">
                <View className="flex-row items-start gap-2">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[12px] font-medium text-foreground">
                      {review.roleTitle ?? 'A teacher here'}
                    </Text>
                    <Text className="mt-0.5 text-[10.5px] text-mutedForeground">
                      {formatPostedAge(review.createdAt, now)}
                    </Text>
                  </View>
                  {review.employmentVerified ? (
                    <StatusBadge label="Verified staff" tone="success" />
                  ) : null}
                </View>
                <Text className="text-[12.5px] leading-5 text-foreground">{review.body}</Text>
                {review.ratings.length > 0 ? (
                  <View className="flex-row flex-wrap gap-1.5">
                    {review.ratings.map((r) => (
                      <Tag
                        key={r.category}
                        label={`${REVIEW_CATEGORY_LABEL[r.category]} ${r.score}/5`}
                      />
                    ))}
                  </View>
                ) : null}
                {review.redFlags.map((flag) => (
                  <View key={flag.kind} className="gap-1 rounded-md bg-destructiveSurface p-2.5">
                    <Text className="text-[11.5px] font-medium text-destructiveForeground">
                      {RED_FLAG_LABEL[flag.kind]}
                    </Text>
                    <Text className="text-[11.5px] leading-4 text-foreground">{flag.reason}</Text>
                  </View>
                ))}
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
