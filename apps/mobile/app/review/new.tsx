import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {
  RED_FLAG_LABEL, REVIEW_CATEGORY_LABEL, REVIEW_LIMITS, validateReviewDraft,
} from '@mwalimu/core';
import { colors, radius } from '@mwalimu/ui';
import type { RedFlagKind, ReviewCategory } from '@mwalimu/types';
import { Button, Card, ErrorBanner, NoticeStrip } from '../../components/ui';
import { AlreadyReviewedError, submitReview } from '../../lib/reviews';

const CATEGORIES = Object.keys(REVIEW_CATEGORY_LABEL) as readonly ReviewCategory[];
const RED_FLAGS = Object.keys(RED_FLAG_LABEL) as readonly RedFlagKind[];

const SCORE_HINT: Readonly<Record<number, string>> = {
  1: 'Bad', 2: 'Poor', 3: 'Mixed', 4: 'Good', 5: 'Very good',
};

/**
 * One category, scored 1-5, or left alone.
 *
 * Skipping is a first-class option, not an oversight: a teacher who never used
 * the staff housing should not be pushed into inventing a number for it. The
 * schema asks for at least one rating, not all ten.
 */
function RatingRow({
  category, score, onChange,
}: {
  category: ReviewCategory;
  score: number | undefined;
  onChange: (next: number | undefined) => void;
}) {
  return (
    <View className="flex-row items-center gap-2 py-1.5">
      <Text className="flex-1 text-[12.5px] text-foreground">
        {REVIEW_CATEGORY_LABEL[category]}
      </Text>
      <View className="flex-row gap-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = score !== undefined && n <= score;
          return (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`${REVIEW_CATEGORY_LABEL[category]}: ${n} of 5, ${SCORE_HINT[n]}`}
              accessibilityState={{ selected: score === n }}
              // Tapping the current score clears it, so a mis-tap is one tap to
              // undo rather than a number you are now stuck with.
              onPress={() => onChange(score === n ? undefined : n)}
              hitSlop={6}
              className="h-9 w-7 items-center justify-center"
            >
              <Feather
                name="star"
                size={17}
                color={on ? colors.foreground : colors.border}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function NewReviewScreen() {
  const { schoolId, schoolName } = useLocalSearchParams<{ schoolId: string; schoolName?: string }>();
  const insets = useSafeAreaInsets();

  const [scores, setScores] = useState<Readonly<Partial<Record<ReviewCategory, number>>>>({});
  const [roleTitle, setRoleTitle] = useState('');
  const [body, setBody] = useState('');
  const [flagReasons, setFlagReasons] = useState<Readonly<Partial<Record<RedFlagKind, string>>>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const [sent, setSent] = useState(false);

  const ratings = useMemo(
    () => CATEGORIES.flatMap((category) => {
      const score = scores[category];
      return score === undefined ? [] : [{ category, score }];
    }),
    [scores],
  );

  const redFlags = useMemo(
    () => RED_FLAGS.flatMap((kind) => {
      const reason = flagReasons[kind];
      return reason === undefined ? [] : [{ kind, reason }];
    }),
    [flagReasons],
  );

  const problems = validateReviewDraft({ body, ratings, redFlags });
  const bodyLeft = REVIEW_LIMITS.bodyMin - body.trim().length;

  const toggleFlag = (kind: RedFlagKind) => {
    setFlagReasons((prev) => {
      const next = { ...prev };
      if (kind in next) delete next[kind];
      else next[kind] = '';
      return next;
    });
  };

  const submit = async () => {
    if (problems.length > 0) {
      // Reveal the reasons rather than leaving a dead button.
      setShowProblems(true);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await submitReview({ schoolId, roleTitle, body: body.trim(), ratings, redFlags });
      // Not router.back(): a review goes to a moderator, so it will NOT appear
      // on the school page. Dropping the writer back there with nothing
      // changed reads as a failure, and they submit again.
      setSent(true);
    } catch (cause) {
      setError(
        cause instanceof AlreadyReviewedError ? cause.message
        : cause instanceof Error ? cause.message
        : 'Could not send your review',
      );
    } finally {
      setSaving(false);
    }
  };

  const leave = () => {
    // Opened from a notification or a deep link there is no history to pop.
    if (router.canGoBack()) router.back();
    else router.replace('/schools');
  };

  if (sent) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ title: 'Thank you' }} />
        <View className="flex-1 justify-center gap-4 px-6">
          <View className="items-center gap-3">
            <Feather name="check-circle" size={28} color={colors.successForeground} />
            <Text className="text-center text-[15px] font-medium text-foreground">
              Sent to a moderator
            </Text>
            <Text className="text-center text-[12.5px] leading-5 text-mutedForeground">
              It will appear on {schoolName ?? 'the school page'} once a moderator has read it.
              You will not see it there before then — that is expected, not a problem with your
              review.
            </Text>
          </View>
          <Button label="Done" onPress={leave} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: schoolName ?? 'Write a review' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <NoticeStrip>
          <Text className="text-[11.5px] leading-4 text-mutedForeground">
            Your name is never shown. A moderator reads every review before it appears, and
            the school can respond.
          </Text>
        </NoticeStrip>

        <Card className="px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">Rate what you know</Text>
          <Text className="mt-0.5 text-[11.5px] leading-4 text-mutedForeground">
            Skip anything you cannot speak to. One category is enough.
          </Text>
          <View className="mt-2">
            {CATEGORIES.map((category) => (
              <RatingRow
                key={category}
                category={category}
                score={scores[category]}
                onChange={(next) => setScores((prev) => {
                  const copy = { ...prev };
                  if (next === undefined) delete copy[category];
                  else copy[category] = next;
                  return copy;
                })}
              />
            ))}
          </View>
        </Card>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">
            Your role there (optional)
          </Text>
          <TextInput
            value={roleTitle}
            onChangeText={setRoleTitle}
            placeholder="Mathematics teacher, 2021–2024"
            placeholderTextColor={colors.mutedForeground}
            className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
          />
        </View>

        <View className="gap-2">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-[13px] font-medium text-foreground">Your review</Text>
            <Text className="text-[11px] text-mutedForeground">
              {bodyLeft > 0 ? `${bodyLeft} more to go` : `${body.trim().length}/${REVIEW_LIMITS.bodyMax}`}
            </Text>
          </View>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="What was it actually like to teach there? Pay, management, workload, how you were treated."
            placeholderTextColor={colors.mutedForeground}
            multiline
            textAlignVertical="top"
            maxLength={REVIEW_LIMITS.bodyMax}
            className="min-h-[140px] rounded-md border border-border bg-card p-3.5 text-[15px] leading-5 text-foreground"
          />
        </View>

        <Card className="px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">
            Red flags (optional)
          </Text>
          <Text className="mt-0.5 text-[11.5px] leading-4 text-mutedForeground">
            A closed list, and each one needs an account of what happened. Up to{' '}
            {REVIEW_LIMITS.maxRedFlags}.
          </Text>

          <View className="mt-2.5 flex-row flex-wrap gap-1.5">
            {RED_FLAGS.map((kind) => {
              const on = kind in flagReasons;
              const full = redFlags.length >= REVIEW_LIMITS.maxRedFlags && !on;
              return (
                <Pressable
                  key={kind}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on, disabled: full }}
                  disabled={full}
                  onPress={() => toggleFlag(kind)}
                  style={{ borderRadius: radius.pill }}
                  className={`px-3 py-2 ${
                    on ? 'bg-foreground' : full ? 'border border-border bg-wash' : 'border border-border bg-card'
                  }`}
                >
                  <Text
                    className={`text-[11.5px] ${
                      on ? 'text-card' : full ? 'text-mutedForeground' : 'text-foreground'
                    }`}
                  >
                    {RED_FLAG_LABEL[kind]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {RED_FLAGS.filter((kind) => kind in flagReasons).map((kind) => {
            const reason = flagReasons[kind] ?? '';
            const left = REVIEW_LIMITS.reasonMin - reason.trim().length;
            return (
              <View key={kind} className="mt-3 gap-1.5">
                <View className="flex-row items-baseline justify-between">
                  <Text className="text-[11.5px] font-medium text-foreground">
                    {RED_FLAG_LABEL[kind]}
                  </Text>
                  <Text className="text-[11px] text-mutedForeground">
                    {left > 0 ? `${left} more to go` : 'ready'}
                  </Text>
                </View>
                <TextInput
                  value={reason}
                  onChangeText={(text) => setFlagReasons((prev) => ({ ...prev, [kind]: text }))}
                  placeholder="What happened, and roughly when?"
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  textAlignVertical="top"
                  maxLength={REVIEW_LIMITS.reasonMax}
                  className="min-h-[80px] rounded-md border border-border bg-card p-3 text-[13.5px] leading-5 text-foreground"
                />
              </View>
            );
          })}
        </Card>

        {showProblems && problems.length > 0 ? (
          <View className="gap-1">
            {problems.map((p) => (
              <Text key={`${p.field}:${p.message}`} className="text-[11.5px] text-destructiveForeground">
                {p.message}
              </Text>
            ))}
          </View>
        ) : null}

        {/*
          The error lives here, beside the button, not at the top of the form.
          This screen is well over a screen tall: a banner up there is invisible
          to the person who just pressed Send and is watching this spot.
        */}
        {error !== null ? <ErrorBanner message={error} /> : null}

        {saving ? (
          <ActivityIndicator color={colors.mutedForeground} className="py-3" />
        ) : (
          <Button label="Send for review" onPress={() => void submit()} />
        )}
      </ScrollView>
    </View>
  );
}
