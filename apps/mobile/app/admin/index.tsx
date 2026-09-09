import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { RED_FLAG_LABEL, REVIEW_CATEGORY_LABEL, formatLabel, formatPostedAge } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import {
  Button, Card, EmptyState, ErrorBanner, NoticeStrip, StatusBadge, Tag,
  centredContent,
} from '../../components/ui';
import {
  fetchQueues, moderateReview, setSchoolVerification, setTscVerified,
  type AdminQueues, type PendingReview,
} from '../../lib/admin';

/**
 * The platform's desk.
 *
 * Until 0016 there was no such thing: reviews defaulted to `pending` with
 * nobody able to approve them, and the two verification flags were writable by
 * whoever benefited from them. Both halves are needed — a rule with no operator
 * is just a stuck queue, which is what the review screen's promise that "a
 * moderator reads every review" had quietly become.
 *
 * Everything here is one decision per row, because that is what moderation is.
 * No bulk approve: the point is that somebody read it.
 */

function ReviewRow({ item, onDecide, busy, now }: {
  item: PendingReview;
  onDecide: (decision: 'approved' | 'rejected') => void;
  busy: boolean;
  now: Date;
}) {
  return (
    <Card className="gap-2.5 p-3.5">
      <View className="flex-row items-start gap-2">
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-medium text-foreground">{item.schoolName}</Text>
          <Text className="mt-0.5 text-[11px] text-mutedForeground">
            {item.review.role_title === null ? 'Role not given' : item.review.role_title}
            {' · '}
            {formatPostedAge(new Date(item.review.created_at), now)}
          </Text>
        </View>
        {item.review.employment_verified ? (
          <StatusBadge label="Verified staff" tone="success" />
        ) : (
          <StatusBadge label="Unverified author" tone="neutral" />
        )}
      </View>

      {/* The author is never named, here least of all: the moderator decides on
          what was written, and a name would invite deciding on who wrote it. */}
      <Text className="text-[12.5px] leading-5 text-foreground">{item.review.body}</Text>

      {item.ratings.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {item.ratings.map((r) => (
            <Tag key={r.category} label={`${REVIEW_CATEGORY_LABEL[r.category]} ${r.score}/5`} />
          ))}
        </View>
      ) : null}

      {/* Red flags are the reason moderation exists. They are accusations about
          a named school, so they get the full reason, not a count. */}
      {item.redFlags.map((flag) => (
        <View key={flag.kind} className="gap-1 rounded-md bg-destructiveSurface p-2.5">
          <View className="flex-row items-center gap-1.5">
            <Feather name="flag" size={11} color={colors.destructiveForeground} />
            <Text className="text-[11.5px] font-medium text-destructiveForeground">
              {RED_FLAG_LABEL[flag.kind]}
              {flag.occurredOn === null ? '' : ` · ${flag.occurredOn}`}
            </Text>
          </View>
          <Text className="text-[11.5px] leading-4 text-foreground">{flag.reason}</Text>
        </View>
      ))}

      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button label="Publish" disabled={busy} onPress={() => onDecide('approved')} />
        </View>
        <View className="flex-1">
          <Button
            label="Reject"
            variant="secondary"
            disabled={busy}
            onPress={() => onDecide('rejected')}
          />
        </View>
      </View>
    </Card>
  );
}

export default function AdminScreen() {
  const [queues, setQueues] = useState<AdminQueues | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  const load = useCallback(async () => {
    try {
      setQueues(await fetchQueues());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the queues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /** Every decision reloads: the queue is the record of what is left to do. */
  const act = async (id: string, work: () => Promise<void>, failure: string) => {
    setBusy(id);
    try {
      await work();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : failure);
    } finally {
      setBusy(null);
    }
  };

  const empty =
    queues !== null
    && queues.reviews.length === 0
    && queues.schools.length === 0
    && queues.tsc.length === 0;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Moderation' }} />
      {loading ? (
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12, ...centredContent }}>
          {error !== null ? <ErrorBanner message={error} /> : null}

          {empty ? (
            <EmptyState
              title="Nothing waiting"
              body="Reviews, school verifications and TSC numbers appear here as they come in."
            />
          ) : null}

          {queues !== null && queues.reviews.length > 0 ? (
            <>
              <Text className="text-[11px] font-medium uppercase tracking-wider text-mutedForeground">
                Reviews to read ({queues.reviews.length})
              </Text>
              <NoticeStrip>
                A review is invisible to everyone but its author until it is published here.
                Reject anything that names an individual or that no reader could act on.
              </NoticeStrip>
              {queues.reviews.map((item) => (
                <ReviewRow
                  key={item.review.id}
                  item={item}
                  now={now}
                  busy={busy === item.review.id}
                  onDecide={(decision) => void act(
                    item.review.id,
                    () => moderateReview(item.review.id, decision),
                    'Could not record that decision',
                  )}
                />
              ))}
            </>
          ) : null}

          {queues !== null && queues.schools.length > 0 ? (
            <>
              <Text className="mt-2 text-[11px] font-medium uppercase tracking-wider text-mutedForeground">
                Schools to verify ({queues.schools.length})
              </Text>
              {queues.schools.map((school) => (
                <Card key={school.id} className="gap-2.5 p-3.5">
                  <View>
                    <Text className="text-[13px] font-medium text-foreground">{school.name}</Text>
                    <Text className="mt-0.5 text-[11px] text-mutedForeground">
                      {formatLabel(school.school_type)} · {formatLabel(school.county)}
                      {school.website === null ? '' : ` · ${school.website}`}
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    <View className="flex-1">
                      <Button
                        label="Verify"
                        disabled={busy === school.id}
                        onPress={() => void act(
                          school.id,
                          () => setSchoolVerification(school.id, 'verified'),
                          'Could not verify that school',
                        )}
                      />
                    </View>
                    <View className="flex-1">
                      <Button
                        label="Send back"
                        variant="secondary"
                        disabled={busy === school.id}
                        onPress={() => void act(
                          school.id,
                          () => setSchoolVerification(school.id, 'unverified'),
                          'Could not update that school',
                        )}
                      />
                    </View>
                  </View>
                </Card>
              ))}
            </>
          ) : null}

          {queues !== null && queues.tsc.length > 0 ? (
            <>
              <Text className="mt-2 text-[11px] font-medium uppercase tracking-wider text-mutedForeground">
                TSC numbers to check ({queues.tsc.length})
              </Text>
              <NoticeStrip>
                Check the number against the TSC register before verifying. A wrong yes here is
                worse than no badge at all — schools filter on it.
              </NoticeStrip>
              {queues.tsc.map((profile) => (
                <Card key={profile.id} className="flex-row items-center gap-3 p-3.5">
                  <View className="min-w-0 flex-1">
                    <Text className="text-[13px] font-medium text-foreground">
                      {profile.full_name}
                    </Text>
                    <Text style={{ fontVariant: ['tabular-nums'] }} className="mt-0.5 text-[12px] text-mutedForeground">
                      TSC {profile.tsc_number} · {formatLabel(profile.county)}
                    </Text>
                  </View>
                  <Button
                    label="Verify"
                    disabled={busy === profile.id}
                    onPress={() => void act(
                      profile.id,
                      () => setTscVerified(profile.id, true),
                      'Could not verify that number',
                    )}
                  />
                </Card>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}
