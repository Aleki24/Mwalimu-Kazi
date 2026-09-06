import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import {
  formatClosing, formatLabel, formatPostedAge, formatSalary, matchBand, type RankedJob,
} from '@mwalimu/core';
import { Badge, Card, SchoolMark } from './ui';

/** Score colour tracks the band so a card and a candidate row never disagree. */
const SCORE_COLOUR = {
  strong: 'text-success',
  good: 'text-primary',
  partial: 'text-warning',
  weak: 'text-muted',
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
              <Text numberOfLines={1} className="text-sm font-bold text-foreground">
                {job.title}
              </Text>
              <Text numberOfLines={1} className="text-[12.5px] text-muted">
                {schoolName}
              </Text>
              <Text className="text-[11.5px] text-mutedFaint">
                {formatSalary(job.salary)} · {formatLabel(job.county)}
              </Text>
            </View>
            <View className="items-end">
              <Text className={`text-base font-extrabold ${SCORE_COLOUR[matchBand(match.score)]}`}>
                {match.score}%
              </Text>
              <Text className="text-[9.5px] font-bold uppercase tracking-wider text-mutedFaint">
                match
              </Text>
            </View>
          </View>

          <View className="mt-2.5 flex-row items-center gap-1.5">
            {job.subjects.slice(0, 2).map((subject) => (
              <Badge key={subject} label={formatLabel(subject)} tone="brand" />
            ))}
            {closing !== null ? (
              <Badge label={closing} tone={urgent ? 'warning' : 'neutral'} />
            ) : null}
            <Text className="ml-auto text-[11px] text-mutedFaint">
              {formatPostedAge(job.postedAt, now)}
            </Text>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}
