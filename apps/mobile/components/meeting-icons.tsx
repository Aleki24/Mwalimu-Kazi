import { Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { meetingOptions } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';

/**
 * Can this be done online, at your place, at theirs — at a glance.
 *
 * Three icons, lit when true and greyed when not, so a teacher scanning a list
 * can tell in one pass which listings they can physically do. Greyed rather
 * than absent on purpose: a missing icon reads as an oversight, a grey one
 * reads as a no, and the difference matters when the question is whether you
 * are expected to cross Nairobi twice a week.
 *
 * The row is decorative — every icon repeats a line that the detail screen
 * spells out in words — so it carries one accessibility label for the set
 * rather than three unreadable ones.
 */

const ICON = {
  online: 'wifi',
  student: 'home',
  teacher: 'navigation',
} as const;

export function MeetingIcons({
  job, size = 13,
}: {
  job: { meetsOnline: boolean; meetsAtStudent: boolean; meetsAtTeacher: boolean };
  size?: number;
}) {
  const options = meetingOptions(job);
  return (
    <View
      className="flex-row items-center gap-2"
      accessibilityLabel={options.filter((o) => o.available).map((o) => o.label).join('. ')}
    >
      {options.map((option) => (
        <Feather
          key={option.key}
          name={ICON[option.key]}
          size={size}
          color={option.available ? colors.primary : colors.disabledForeground}
        />
      ))}
    </View>
  );
}

/** The same three, in words, for a detail screen. */
export function MeetingList({
  job,
}: {
  job: { meetsOnline: boolean; meetsAtStudent: boolean; meetsAtTeacher: boolean };
}) {
  return (
    <View className="gap-1.5">
      {meetingOptions(job).map((option) => (
        <View key={option.key} className="flex-row items-center gap-2">
          <Feather
            name={ICON[option.key]}
            size={13}
            color={option.available ? colors.primary : colors.disabledForeground}
          />
          <Text
            className={`text-[12px] ${
              option.available ? 'text-foreground' : 'text-disabledForeground'
            }`}
          >
            {option.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
