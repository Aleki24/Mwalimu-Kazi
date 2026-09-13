import { Text, View } from 'react-native';
import { formatLabel, formatRate } from '@mwalimu/core';
import { Avatar, Card, StatusBadge, Tag } from './ui';
import { MeetingIcons } from './meeting-icons';
import type { Tutor } from '../lib/tutors';

/**
 * One teacher offering private tuition.
 *
 * Built to answer the three questions a parent actually has, in the order they
 * have them: can they teach what I need, can they get to us, and what does it
 * cost. Everything else — the years, the TSC check — is reassurance, so it
 * sits behind the name rather than in front of the subjects.
 */
export function TutorCard({ tutor }: { tutor: Tutor }) {
  const rate = formatRate(
    tutor.rateMin === null ? undefined : {
      min: tutor.rateMin,
      ...(tutor.rateMax === null ? {} : { max: tutor.rateMax }),
    },
    tutor.ratePeriod,
  );

  return (
    <Card className="gap-2.5 p-3.5">
      <View className="flex-row items-center gap-2.5">
        <Avatar name={tutor.fullName} size={38} />
        <View className="min-w-0 flex-1">
          <Text className="text-[13.5px] font-medium text-foreground">{tutor.fullName}</Text>
          <Text className="text-[11.5px] text-mutedForeground">
            {[
              tutor.headline,
              tutor.experienceYears > 0 ? `${tutor.experienceYears} yrs` : null,
            ].filter((p) => p !== null && p !== '').join(' · ')}
          </Text>
        </View>
        {tutor.tscVerified ? <StatusBadge label="TSC verified" tone="success" /> : null}
      </View>

      <View className="flex-row flex-wrap items-center gap-1.5">
        {tutor.subjects.slice(0, 4).map((s) => <Tag key={s} label={formatLabel(s)} />)}
        <MeetingIcons job={{
          meetsOnline: tutor.meetsOnline,
          meetsAtStudent: tutor.meetsAtStudent,
          meetsAtTeacher: tutor.meetsAtTeacher,
        }}
        />
      </View>

      <View className="flex-row items-center gap-2">
        <Text className="min-w-0 flex-1 text-[11.5px] text-mutedForeground">
          {[
            tutor.area,
            tutor.county === null ? null : formatLabel(tutor.county),
            ...tutor.learnerLevels.slice(0, 2),
          ].filter((p) => p !== null && p !== '').join(' · ')}
        </Text>
        <Text className="text-[12px] font-medium text-foreground">{rate}</Text>
      </View>
    </Card>
  );
}
