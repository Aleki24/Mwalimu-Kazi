import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Feather from '@expo/vector-icons/Feather';
import { CARD_RADIUS, colors, shadow } from '@mwalimu/ui';

/**
 * The one gradient in the app.
 *
 * Everything else is flat, which is what makes this read as the single most
 * important thing on the screen rather than as decoration. Both ends are dark
 * enough for white text — #1E3A5F clears 11.5:1 and #2A5484 clears 7.8:1 — so
 * the copy is legible wherever the ramp lands, including on Android where
 * dithering shifts it slightly.
 *
 * The gradient runs top-left to bottom-right rather than straight down: a
 * vertical ramp on a wide card looks like a rendering artefact, a diagonal one
 * looks intentional.
 */
const HERO_COLOURS = [colors.heroFrom, colors.heroTo] as const;

export function HeroCard({
  eyebrow,
  title,
  meta,
  right,
  footer,
  onPress,
  accessibilityLabel,
}: {
  /** What this is: "Interview scheduled". Sets the context in two words. */
  readonly eyebrow: string;
  /** Who it is with. The line a teacher scans for. */
  readonly title: string;
  /** When, where — the detail that makes it actionable. */
  readonly meta: string;
  /** Usually a ProgressRing with `onDark`. */
  readonly right?: ReactNode;
  readonly footer?: ReactNode;
  readonly onPress?: () => void;
  readonly accessibilityLabel?: string;
}) {
  const plate = (
    <LinearGradient
      colors={HERO_COLOURS}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: CARD_RADIUS, borderCurve: 'continuous', padding: 16, ...shadow.resting }}
    >
      <View className="flex-row items-center gap-4">
        <View className="min-w-0 flex-1">
          <Text className="text-[11px] uppercase tracking-wider text-primaryForeground/70">
            {eyebrow}
          </Text>
          <Text numberOfLines={2} className="mt-1.5 text-[17px] font-medium leading-6 text-primaryForeground">
            {title}
          </Text>
          <Text numberOfLines={1} className="mt-1 text-[13px] text-primaryForeground/80">
            {meta}
          </Text>
        </View>
        {right}
      </View>

      {footer === undefined ? null : (
        // A hairline of the card's own white rather than a border token: the
        // border tokens are ink mixes and vanish against indigo.
        <View className="mt-3.5 border-t border-white/15 pt-3">{footer}</View>
      )}
    </LinearGradient>
  );

  if (onPress === undefined) return plate;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${eyebrow}. ${title}. ${meta}`}
      onPress={onPress}
    >
      {plate}
    </Pressable>
  );
}

/**
 * The footer row a hero usually wants: one short call to action with a chevron.
 * Separate from HeroCard so a hero can carry something else — a pipeline, a
 * second date — without this being in the way.
 */
export function HeroAction({ label }: { readonly label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Text className="text-[12.5px] font-medium text-primaryForeground">{label}</Text>
      <Feather name="arrow-right" size={13} color={colors.primaryForeground} />
    </View>
  );
}
