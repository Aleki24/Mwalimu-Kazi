import { Link } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { Pressable, Text, View } from 'react-native';
import {
  formatClosing, formatLabel, formatPostedAge, formatSalary, matchBand, type RankedJob,
} from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { Badge, Card, SchoolMark, Tag, tabularNums } from './ui';

/**
 * Score colour tracks the band so a card and a candidate row never disagree.
 * These are text tints, which rule 7 allows; the score is never a filled chip.
 */
const SCORE_COLOUR = {
  strong: 'text-successForeground',
  good: 'text-foreground',
  partial: 'text-warningForeground',
  weak: 'text-mutedForeground',
} as const;

export function JobCard({ entry, now }: { entry: RankedJob; now: Date }) {
  const { job, schoolName, match, schoolVerification, posterKind } = entry;
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
        <Card className="p-3.5">
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
            <View className="items-end">
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

          <View className="mt-2.5 flex-row items-center gap-1.5">
            {job.subjects.slice(0, 2).map((subject) => (
              <Tag key={subject} label={formatLabel(subject)} />
            ))}
            {closing !== null ? (
              urgent ? <Badge label={closing} tone="warning" /> : <Tag label={closing} />
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
