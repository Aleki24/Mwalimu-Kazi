import { Pressable, ScrollView, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors, HIT_TARGET_MIN, radius } from '@mwalimu/ui';

/**
 * One offerable day. `id` is an ISO date (`2026-09-14`) rather than a Date so
 * the value can be compared, stored and sent to the server unchanged — a Date
 * carries a time zone the scheduler does not mean.
 */
export interface DayOption {
  readonly id: string;
  /** Single letter or short weekday: "M", "Tue". */
  readonly weekday: string;
  /** Day of month, as shown. */
  readonly day: string;
  readonly disabled?: boolean;
}

/** One offerable time. `full` is a school's constraint, not the teacher's. */
export interface SlotOption {
  readonly id: string;
  readonly label: string;
  readonly full?: boolean;
}

/**
 * The horizontal month strip.
 *
 * Scrolls rather than paginating: a teacher choosing an interview slot is
 * picking from days a school offered, which is a short list in one or two
 * weeks, not an open calendar to navigate.
 */
export function MonthStrip({
  month,
  days,
  selected,
  onSelect,
}: {
  /** "September 2026" — formatted by the caller, which owns the locale. */
  readonly month: string;
  readonly days: readonly DayOption[];
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
}) {
  return (
    <View className="gap-2.5">
      <Text className="text-[13px] font-medium text-foreground">{month}</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 4 }}
      >
        {days.map((day) => {
          const isSelected = day.id === selected;
          const disabled = day.disabled === true;

          return (
            <Pressable
              key={day.id}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={`${day.weekday} ${day.day}${disabled ? ', unavailable' : ''}`}
              disabled={disabled}
              onPress={() => onSelect(day.id)}
              style={{
                width: 48,
                minHeight: HIT_TARGET_MIN + 16,
                borderRadius: radius.xl,
                borderCurve: 'continuous',
                backgroundColor: isSelected ? colors.primary : colors.card,
                borderWidth: isSelected ? 0 : 1,
                borderColor: colors.border,
                opacity: disabled ? 0.45 : 1,
              }}
              className="items-center justify-center gap-1"
            >
              <Text
                style={{ color: isSelected ? 'rgba(255,255,255,0.72)' : colors.mutedForeground }}
                className="text-[10.5px] uppercase tracking-wider"
              >
                {day.weekday}
              </Text>
              <Text
                style={[
                  { color: isSelected ? colors.primaryForeground : colors.foreground },
                  TABULAR,
                ]}
                className="text-[16px] font-medium"
              >
                {day.day}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/**
 * The time-slot grid: available, selected, fully booked.
 *
 * A booked slot stays on screen, dimmed, rather than being filtered out. Seeing
 * that 10:00 and 11:00 are gone is what tells a teacher the school is busy and
 * the remaining slots are worth taking now.
 *
 * Two columns at phone widths, three once there is room — the tiles are
 * `flex-basis` percentages inside a wrapping row, so this needs no width
 * listener and behaves the same on a 320pt phone and a tablet.
 */
export function SlotGrid({
  slots,
  selected,
  onSelect,
  columns = 3,
}: {
  readonly slots: readonly SlotOption[];
  readonly selected: string | null;
  readonly onSelect: (id: string) => void;
  readonly columns?: 2 | 3;
}) {
  const basis = columns === 2 ? '48%' : '31.5%';

  return (
    <View className="flex-row flex-wrap gap-2">
      {slots.map((slot) => {
        const full = slot.full === true;
        const isSelected = slot.id === selected && !full;

        return (
          <Pressable
            key={slot.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled: full }}
            accessibilityLabel={full ? `${slot.label}, fully booked` : slot.label}
            disabled={full}
            onPress={() => onSelect(slot.id)}
            style={{
              flexBasis: basis,
              flexGrow: 1,
              minHeight: HIT_TARGET_MIN,
              borderRadius: radius.xl,
              borderCurve: 'continuous',
              // Selected is the ink chip, not indigo: indigo is already
              // carrying the chosen date directly above, and two indigo fills
              // in one column stop telling you which one you last touched.
              backgroundColor: isSelected ? colors.foreground : full ? colors.wash : colors.card,
              borderWidth: isSelected ? 0 : 1,
              borderColor: full ? 'transparent' : colors.border,
            }}
            className="items-center justify-center px-2 py-2.5"
          >
            <Text
              style={[
                {
                  color: isSelected ? colors.card
                    : full ? colors.disabledForeground
                    : colors.foreground,
                },
                TABULAR,
              ]}
              className="text-[13.5px] font-medium"
            >
              {slot.label}
            </Text>
            {full ? (
              <Text style={{ color: colors.disabledForeground }} className="mt-0.5 text-[10px]">
                Fully booked
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A two-or-more-way segmented control.
 *
 * Generic over the option values so `value` and `onChange` are checked against
 * the same union the options declare — passing 'meet' to a control offering
 * 'in_person' | 'google_meet' does not compile.
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  readonly options: readonly { readonly value: T; readonly label: string; readonly icon?: React.ComponentProps<typeof Feather>['name'] }[];
  readonly value: T;
  readonly onChange: (next: T) => void;
}) {
  return (
    <View
      style={{ borderRadius: radius.pill, backgroundColor: colors.wash, padding: 3 }}
      className="flex-row"
      accessibilityRole="tablist"
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: HIT_TARGET_MIN - 6,
              borderRadius: radius.pill,
              backgroundColor: isSelected ? colors.card : 'transparent',
            }}
            className="flex-row items-center justify-center gap-1.5 px-3"
          >
            {option.icon === undefined ? null : (
              <Feather
                name={option.icon}
                size={14}
                color={isSelected ? colors.primary : colors.mutedForeground}
              />
            )}
            <Text
              style={{ color: isSelected ? colors.primary : colors.mutedForeground }}
              className="text-[13px] font-medium"
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const TABULAR = { fontVariant: ['tabular-nums' as const] };
