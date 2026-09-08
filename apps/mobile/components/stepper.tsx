import { Text, View } from 'react-native';
import { colors, radius } from '@mwalimu/ui';

/**
 * The progress bar at the top of a multi-step form.
 *
 * Segments rather than one continuous bar: a form has a known number of steps,
 * and showing four discrete bars tells you how much is left in a way a 50%
 * fill does not. The step name sits beside the count because "Step 2 of 4"
 * alone tells you where you are but not what you are about to do.
 *
 * Generic over the step tuple so `current` cannot exceed the number of steps —
 * a stepper claiming step 5 of 4 is caught at compile time, not in review.
 */
export function Stepper<const T extends readonly [string, ...string[]]>({
  steps,
  current,
}: {
  readonly steps: T;
  /** 1-based index of the step being filled in. */
  readonly current: number;
}) {
  const total = steps.length;
  const active = Math.min(Math.max(1, Math.round(current)), total);
  const label = steps[active - 1];

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 1, max: total, now: active }}
      accessibilityLabel={`Step ${active} of ${total}: ${label}`}
    >
      <View className="flex-row items-baseline justify-between">
        <Text className="text-[13px] font-medium text-foreground">{label}</Text>
        <Text style={TABULAR} className="text-[11.5px] text-mutedForeground">
          {`Step ${active} of ${total}`}
        </Text>
      </View>

      <View className="mt-2 flex-row gap-1.5">
        {steps.map((step, index) => (
          <View
            key={step}
            style={{
              flex: 1,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: index < active ? colors.primary : colors.secondary,
            }}
          />
        ))}
      </View>
    </View>
  );
}

const TABULAR = { fontVariant: ['tabular-nums' as const] };
