import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import {
  formatClosing, formatLabel, formatPostedAge, formatSalary, matchBand, type RankedJob,
} from '@mwalimu/core';
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
  const { job, schoolName, match } = entry;
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
              <Text numberOfLines={1} className="text-[12.5px] text-mutedForeground">
                {schoolName}
              </Text>
              <Text className="text-[11.5px] text-mutedForeground">
                {formatSalary(job.salary)} · {formatLabel(job.county)}
              </Text>
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
