import type { ReactNode } from 'react';
import { Platform, Pressable, Switch, Text, View, type PressableProps, type ViewProps } from 'react-native';
import { colors, HIT_TARGET_MIN, radius, shadow } from '@mwalimu/ui';

/**
 * The OA surface system, ported to React Native.
 *
 * Two translations worth knowing about:
 *
 * - The squircle. OA draws continuous-curvature corners with a CSS `shape()`
 *   clip-path. React Native has no clip-path; `borderCurve: 'continuous'` gets
 *   the same silhouette on iOS and is ignored on Android, which falls back to a
 *   circular corner. That is a real fidelity gap on Android, not a shim.
 * - Semantic colour. Rule 7 says semantic colours tint text and small dots and
 *   never fill a surface, so `Badge` is a dot plus a word, not a coloured pill.
 */

/** iOS honours this; Android ignores it and rounds circularly. */
const SQUIRCLE = Platform.select({ ios: { borderCurve: 'continuous' as const }, default: {} });

/**
 * A plate: white surface, hairline border, resting shadow, squircle corners.
 * The page background between plates is the only divider — no rules, ever.
 */
export function Card({ children, className = '', style, ...rest }: ViewProps & { children: ReactNode }) {
  return (
    <View
      style={[{ borderRadius: radius.xl2, ...SQUIRCLE }, shadow.resting, style]}
      className={`border border-border bg-card p-4 ${className}`}
      {...rest}
    >
      {children}
    </View>
  );
}

/**
 * The recessed inset: ink at 5% inside a plate. The second of OA's two layers.
 */
export function Inset({ children, className = '', style, ...rest }: ViewProps & { children: ReactNode }) {
  return (
    <View
      style={[{ borderRadius: radius.xl, ...SQUIRCLE }, style]}
      className={`bg-wash p-3 ${className}`}
      {...rest}
    >
      {children}
    </View>
  );
}

export type Tone = 'neutral' | 'primary' | 'success' | 'danger' | 'warning' | 'info';

const DOT: Readonly<Record<Tone, string>> = {
  neutral: colors.mutedForeground,
  primary: colors.primary,
  success: colors.success,
  danger: colors.destructive,
  warning: colors.warning,
  info: colors.info,
};

const TEXT: Readonly<Record<Tone, string>> = {
  neutral: colors.mutedForeground,
  primary: colors.primary,
  success: colors.successForeground,
  danger: colors.destructiveForeground,
  warning: colors.warningForeground,
  info: colors.infoForeground,
};

/**
 * A status word with a coloured dot — NOT a filled pill.
 *
 * "A success state is a sentence with an emerald dot, not a green card."
 * Filled semantic chips were the loudest thing on every screen before this.
 */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View className="flex-row items-center gap-1.5 self-start">
      {tone === 'neutral' ? null : (
        <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: DOT[tone] }} />
      )}
      <Text style={{ color: TEXT[tone] }} className="text-xs">{label}</Text>
    </View>
  );
}

/**
 * Why the button above it will not press.
 *
 * A greyed-out control with no explanation is indistinguishable from a broken
 * one, and these forms grey the action while every field still shows its
 * placeholder — which reads as filled in. Naming what is outstanding costs one
 * line and turns "this app is broken" into "oh, the title".
 *
 * Renders nothing when nothing is missing, so the caller can mount it
 * unconditionally beside the button it explains.
 */
export function WhyDisabled({ missing }: { missing: readonly string[] }) {
  if (missing.length === 0) return null;
  const list =
    missing.length === 1 ? missing[0]
    : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;
  return (
    <Text className="px-2 text-center text-[11px] leading-4 text-mutedForeground">
      Add {list} to continue.
    </Text>
  );
}

/** A quiet metadata tag: flat grey, no border, no colour. */
export function Tag({ label }: { label: string }) {
  return (
    <View className="self-start rounded-full bg-secondary px-2.5 py-1">
      <Text className="text-xs text-foreground/80">{label}</Text>
    </View>
  );
}

/** Everything clickable that is not a card is a pill. */
/**
 * A chip is a control, so `onPress` is required rather than optional.
 *
 * That is not pedantry: a Chip is itself a Pressable, and wrapping one in
 * another Pressable to add the handler puts a hit target on top of the
 * handler — the press lands on the inner Chip, which does nothing. That bug
 * shipped on onboarding once and was still live on Jobs, News and Resources.
 * Making the handler mandatory turns the next occurrence into a type error.
 * For a chip-shaped thing that is only a label, use `Tag`.
 */
export function Chip({
  label, selected = false, onPress,
}: { label: string; selected?: boolean; onPress: PressableProps['onPress'] }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ minHeight: HIT_TARGET_MIN, borderRadius: radius.pill }}
      className={`justify-center px-4 ${selected ? 'bg-foreground' : 'border border-border bg-card'}`}
    >
      <Text className={`text-sm ${selected ? 'text-card' : 'text-mutedForeground'}`}>{label}</Text>
    </Pressable>
  );
}

/**
 * Primary spends the one accent; secondary is flat grey with no border.
 * Buttons say what happens — the label is the caller's job, not a generic "OK".
 */
export function Button({
  label, onPress, variant = 'primary', disabled = false, className = '',
}: {
  label: string;
  onPress?: PressableProps['onPress'];
  variant?: 'primary' | 'secondary' | 'quiet';
  disabled?: boolean;
  className?: string;
}) {
  const surface =
    disabled ? 'bg-secondary'
    : variant === 'primary' ? 'bg-primary'
    : variant === 'secondary' ? 'bg-secondary'
    : 'border border-border bg-card';

  const text =
    disabled ? 'text-mutedForeground'
    : variant === 'primary' ? 'text-primaryForeground'
    : 'text-foreground';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: 46, borderRadius: radius.pill }}
      className={`items-center justify-center px-5 ${surface} ${className}`}
    >
      <Text className={`text-sm font-medium ${text}`}>{label}</Text>
    </Pressable>
  );
}

/** Square school mark. Flat grey; the accent is not spent here. */
export function SchoolMark({ name, size = 40 }: { name: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={{ width: size, height: size, borderRadius: radius.lg, ...SQUIRCLE }}
      className="items-center justify-center bg-secondary"
    >
      <Text style={{ fontSize: Math.round(size * 0.38) }} className="font-medium text-foreground/70">
        {initial}
      </Text>
    </View>
  );
}

/** Initials on a flat disc. `onPress` makes it the route into a profile. */
export function Avatar({
  name, size = 40, onPress, label,
}: { name: string; size?: number; onPress?: PressableProps['onPress']; label?: string }) {
  const initials = name.trim().split(/\s+/).map((p) => p.charAt(0)).slice(0, 2).join('').toUpperCase();
  const disc = (
    <View
      style={{ width: size, height: size, borderRadius: 999 }}
      className="items-center justify-center bg-secondary"
    >
      <Text style={{ fontSize: Math.round(size * 0.34) }} className="font-medium text-foreground/70">
        {initials || '?'}
      </Text>
    </View>
  );

  if (onPress === undefined) return disc;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label ?? `Open ${name}'s profile`}
      onPress={onPress}
      hitSlop={(HIT_TARGET_MIN - size) / 2}
    >
      {disc}
    </Pressable>
  );
}

/** Chrome renders instantly: the title never waits for data. */
export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="bg-card px-5 pb-4 pt-2">
      <Text className="text-2xl font-medium tracking-tight text-foreground">{title}</Text>
      {subtitle !== undefined ? (
        <Text className="mt-1 text-sm text-mutedForeground">{subtitle}</Text>
      ) : null}
    </View>
  );
}

/**
 * A standing condition, not an event: a strip lives exactly as long as the
 * state it describes. One-off outcomes are toasts, which retire themselves.
 */
export function NoticeStrip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <View
      style={{ borderRadius: radius.xl2, ...SQUIRCLE }}
      className="flex-row items-center gap-2.5 border border-border bg-card px-4 py-3"
    >
      <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: DOT[tone] }} />
      <View className="flex-1">{children}</View>
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View className="items-center px-8 py-16">
      <Text className="text-base font-medium text-foreground">{title}</Text>
      <Text className="mt-1.5 text-center text-sm leading-5 text-mutedForeground">{body}</Text>
    </View>
  );
}

/** Errors name the cause and the way out, without blame. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <NoticeStrip tone="danger">
      <Text style={{ color: colors.destructiveForeground }} className="text-sm">{message}</Text>
    </NoticeStrip>
  );
}

/** Numbers that sit in a column or update in place align by figure. */
export const tabularNums = { fontVariant: ['tabular-nums' as const] };

/**
 * A labelled switch where the whole row is the target.
 *
 * A bare <Switch> is about 51×31 — under the 44pt minimum in one dimension and
 * surrounded by text that looks tappable but is not. People tap the words. So
 * the row is the control and the switch is just its indicator.
 */
export function ToggleRow({
  label, hint, value, onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onValueChange(!value)}
      style={{ minHeight: HIT_TARGET_MIN }}
      className="flex-row items-center gap-3"
    >
      <View className="min-w-0 flex-1">
        <Text className="text-[13px] font-medium text-foreground">{label}</Text>
        {hint === undefined ? null : (
          <Text className="mt-0.5 text-[11.5px] text-mutedForeground">{hint}</Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.primary, false: colors.secondary }}
        thumbColor={colors.card}
        ios_backgroundColor={colors.secondary}
        // The row already handles the press; the switch must not fire twice.
        pointerEvents="none"
      />
    </Pressable>
  );
}
