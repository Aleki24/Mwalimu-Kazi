import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@mwalimu/ui';

/** Figures align as the step advances, so the centre does not jitter. */
const TABULAR = { fontVariant: ['tabular-nums' as const] };

/**
 * A ring showing how far through a fixed sequence something is.
 *
 * Drawn with a stroked circle and a dash offset rather than two rotated
 * half-discs: the half-disc trick needs no SVG dependency but seams visibly on
 * Android at these sizes, and the ring sits inside the hero card where a seam
 * is the first thing you notice.
 *
 * `onDark` is a boolean rather than a pair of colour props because there are
 * exactly two places a ring appears — on the indigo hero and on a white card —
 * and letting callers pass arbitrary colours is how a third, unreviewed variant
 * quietly appears.
 */
export function ProgressRing({
  step,
  total,
  size = 56,
  thickness = 5,
  onDark = false,
  label,
}: {
  /** Steps completed. Clamped into 0…total rather than trusted. */
  readonly step: number;
  readonly total: number;
  readonly size?: number;
  readonly thickness?: number;
  readonly onDark?: boolean;
  /** Overrides the default `3/5` centre. */
  readonly label?: string;
}) {
  const safeTotal = Math.max(1, Math.round(total));
  const done = Math.min(Math.max(0, Math.round(step)), safeTotal);

  const ringRadius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * ringRadius;
  const filled = circumference * (done / safeTotal);

  const trackColour = onDark ? 'rgba(255,255,255,0.24)' : colors.secondary;
  const tint = onDark ? colors.primaryForeground : colors.primary;

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: safeTotal, now: done }}
      accessibilityLabel={`Step ${done} of ${safeTotal}`}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2} cy={size / 2} r={ringRadius}
          stroke={trackColour} strokeWidth={thickness} fill="none"
        />
        <Circle
          cx={size / 2} cy={size / 2} r={ringRadius}
          stroke={tint} strokeWidth={thickness} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          // Start the arc at twelve o'clock instead of three.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <View className="absolute inset-0 items-center justify-center">
        <Text
          style={[{ color: tint, fontSize: Math.round(size * 0.25) }, TABULAR]}
          className="font-medium"
        >
          {label ?? `${done}/${safeTotal}`}
        </Text>
      </View>
    </View>
  );
}
