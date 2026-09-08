import { Link } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import {
  formatClosing, formatLabel, formatPostedAge, formatSalary, matchBand, type RankedJob,
} from '@mwalimu/core';
import { colors, HIT_TARGET_MIN } from '@mwalimu/ui';
import { Card, DeadlineChip, SchoolMark, StatusBadge, Tag, tabularNums } from './ui';

/**
 * Score colour tracks the band so a card and a candidate row never disagree.
 * These are text tints; the score is never a filled chip — a number that big
 * does not need a background to be found.
 */
const SCORE_COLOUR = {
  strong: 'text-successForeground',
  good: 'text-foreground',
  partial: 'text-warningForeground',
  weak: 'text-mutedForeground',
} as const;

export function JobCard({
  entry, now, saved, onToggleSave,
}: {
  readonly entry: RankedJob;
  readonly now: Date;
  /** Omit both save props and the bookmark does not render at all. */
  readonly saved?: boolean;
  readonly onToggleSave?: (jobId: string) => void;
}) {
  const { job, schoolName, match, schoolVerification, posterKind } = entry;

  // Closed is derived, not stored: a deadline in the past IS the closure, and
  // a separate status column would be a second source of truth that can drift
  // behind the date the school actually advertised.
  const closed = job.closesAt !== undefined && job.closesAt.getTime() < now.getTime();

  // One line, both cases: a listing is either from a checked school or it is
  // not, and a teacher deciding whether to send documents needs that either
  // way. 'pending' and 'under_review' are not verified yet, so they say so.
  const unchecked = posterKind !== 'school'
    ? 'Posted by an individual'
    : schoolVerification !== 'verified' ? 'Unverified school' : null;

  const closing = formatClosing(job.closesAt, now);
  const urgent = closing === 'Closes today' || closing === 'Closes tomorrow';

  return (
    <Link href={{ pathname: '/job/[id]', params: { id: job.id } }} asChild>
      <Pressable accessibilityRole="button">
        {/*
          A closed listing dims rather than disappearing. It still answers the
          question a teacher is actually asking — "did I miss this one?" — and
          a list that silently loses rows is a list you cannot trust.
        */}
        <Card className="p-3.5" style={closed ? { opacity: 0.55 } : undefined}>
          <View className="flex-row items-start gap-3">
            <SchoolMark name={schoolName} />

            <View className="min-w-0 flex-1">
              <Text numberOfLines={1} className="text-sm font-medium text-foreground">
                {job.title}
              </Text>
              <View className="flex-row items-center gap-1.5">
                <Text numberOfLines={1} className="shrink text-[12.5px] text-mutedForeground">
                  {schoolName}
                </Text>
                {schoolVerification === 'verified' ? (
                  <Feather name="check-circle" size={11} color={colors.successForeground} />
                ) : null}
              </View>
              <Text className="text-[11.5px] text-mutedForeground">
                {formatSalary(job.salary)} · {formatLabel(job.county)}
              </Text>
              {unchecked === null ? null : (
                <View className="mt-0.5 flex-row items-center gap-1">
                  <View
                    style={{ width: 5, height: 5, borderRadius: 999 }}
                    className="bg-warningForeground"
                  />
                  <Text className="text-[11px] text-warningForeground">{unchecked}</Text>
                </View>
              )}
            </View>

            <View className="items-end gap-1.5">
              {onToggleSave === undefined ? null : (
                <SaveButton
                  saved={saved === true}
                  title={job.title}
                  onPress={() => onToggleSave(job.id)}
                />
              )}
              <Text
                style={tabularNums}
                className={`text-lg font-medium ${SCORE_COLOUR[matchBand(match.score)]}`}
              >
                {match.score}%
              </Text>
              <Text className="text-[10px] uppercase tracking-wider text-mutedForeground">
                match
              </Text>
            </View>
          </View>

          <View className="mt-2.5 flex-row flex-wrap items-center gap-1.5">
            {job.subjects.slice(0, 2).map((subject) => (
              <Tag key={subject} label={formatLabel(subject)} />
            ))}
            {closed ? (
              <StatusBadge label="Closed" tone="danger" />
            ) : closing !== null ? (
              <DeadlineChip label={closing} urgent={urgent} />
            ) : null}
            <Text className="ml-auto text-[11px] text-mutedForeground">
              {formatPostedAge(job.postedAt, now)}
            </Text>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

/**
 * The bookmark.
 *
 * It sits inside a card that is itself a link, so it stops the press from
 * reaching the card — tapping save must never also navigate away from the list
 * you are triaging.
 */
function SaveButton({
  saved, title, onPress,
}: { readonly saved: boolean; readonly title: string; readonly onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: saved }}
      accessibilityLabel={saved ? `Remove ${title} from saved` : `Save ${title}`}
      hitSlop={12}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={{ minWidth: HIT_TARGET_MIN / 2, alignItems: 'flex-end' }}
    >
      <Feather
        name="bookmark"
        size={17}
        color={saved ? colors.primary : colors.disabledForeground}
      />
    </Pressable>
  );
}
