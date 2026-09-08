import type { ReactNode } from 'react';
import {
  Platform, Pressable, Switch, Text, TextInput, View,
  type PressableProps, type ViewProps,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import {
  CARD_RADIUS, colors, HIT_TARGET_MIN, radius, shadow, STATUS, type StatusTone,
} from '@mwalimu/ui';

/**
 * The surface system.
 *
 * Two translations worth knowing about:
 *
 * - The squircle. Continuous-curvature corners are a CSS `shape()` clip-path on
 *   the web and have no React Native equivalent; `borderCurve: 'continuous'`
 *   gets the same silhouette on iOS and is ignored on Android, which falls back
 *   to a circular corner. That is a real fidelity gap, not a shim.
 * - Filled colour. Indigo is the only hue that fills a large surface. Semantic
 *   colours fill nothing bigger than a chip, and when they do they use the
 *   tint-plus-dark-text pairing from `STATUS` rather than a saturated block —
 *   see the contrast note on `SemanticTriple`.
 */

/** iOS honours this; Android ignores it and rounds circularly. */
const SQUIRCLE = Platform.select({ ios: { borderCurve: 'continuous' as const }, default: {} });

/**
 * A plate: white surface, hairline border, resting shadow, 16px corners.
 * The canvas showing between plates is the only divider — no rules, ever.
 */
export function Card({ children, className = '', style, ...rest }: ViewProps & { children: ReactNode }) {
  return (
    <View
      style={[{ borderRadius: CARD_RADIUS, ...SQUIRCLE }, shadow.resting, style]}
      className={`border border-border bg-card p-4 ${className}`}
      {...rest}
    >
      {children}
    </View>
  );
}

/** The recessed inset: ink at 4% inside a plate. The second of the two layers. */
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

export type Tone = StatusTone;

/**
 * A status word with a coloured dot — no fill.
 *
 * This is the quiet form, for metadata sitting inside a card that already has
 * plenty going on. When the status IS the point of the row — a tracker line, a
 * closed listing — reach for `StatusBadge` instead.
 */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  return (
    <View className="flex-row items-center gap-1.5 self-start">
      {tone === 'neutral' ? null : (
        <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: STATUS[tone].fill }} />
      )}
      <Text style={{ color: STATUS[tone].text }} className="text-xs">{label}</Text>
    </View>
  );
}

/**
 * The loud form: a tinted pill carrying dark text of the same hue.
 *
 * Every filled status in the app is this one component, so a deadline chip and
 * an "Under review" badge cannot end up with different padding, radius or
 * contrast handling. `icon` takes a rendered glyph rather than a name so the
 * pill does not have to know about an icon set.
 */
export function StatusBadge({
  label, tone, icon, className = '',
}: { label: string; tone: Tone; icon?: ReactNode; className?: string }) {
  const { text, surface } = STATUS[tone];
  return (
    <View
      style={{ backgroundColor: surface, borderRadius: radius.pill }}
      className={`flex-row items-center gap-1 self-start px-2.5 py-1 ${className}`}
    >
      {icon}
      <Text style={{ color: text }} className="text-[11.5px] font-medium">{label}</Text>
    </View>
  );
}

/**
 * A closing date, and the only place coral is allowed to appear on a list.
 *
 * `urgent` is not a prop: whether a deadline is urgent is a fact about the
 * date, so the component decides it. Anything else lets one screen call a
 * two-week deadline coral while another does not.
 */
export function DeadlineChip({ label, urgent }: { label: string; urgent: boolean }) {
  return <StatusBadge label={label} tone={urgent ? 'urgent' : 'neutral'} />;
}

/** A quiet metadata tag: flat grey, no border, no colour. */
export function Tag({ label }: { label: string }) {
  return (
    <View className="self-start rounded-full bg-secondary px-2.5 py-1">
      <Text className="text-xs text-foreground/80">{label}</Text>
    </View>
  );
}

/** Everything clickable that is not a card is a pill. Selected spends indigo. */
export function Chip({
  label, selected = false, onPress,
}: { label: string; selected?: boolean; onPress?: PressableProps['onPress'] }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{ minHeight: HIT_TARGET_MIN, borderRadius: radius.pill }}
      className={`justify-center px-4 ${selected ? 'bg-primary' : 'border border-border bg-card'}`}
    >
      <Text className={`text-sm ${selected ? 'text-primaryForeground font-medium' : 'text-mutedForeground'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Primary spends indigo; secondary is flat grey with no border.
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
    disabled ? 'text-disabledForeground'
    : variant === 'primary' ? 'text-primaryForeground'
    : 'text-foreground';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ minHeight: 48, borderRadius: radius.pill }}
      className={`items-center justify-center px-5 ${surface} ${className}`}
    >
      <Text className={`text-sm font-medium ${text}`}>{label}</Text>
    </Pressable>
  );
}

/**
 * The search field that sits above a list.
 *
 * A controlled input rather than one that owns its own text: the query is a
 * filter, the filter belongs to the screen, and a search box holding state the
 * results do not know about is how a list ends up disagreeing with the words
 * above it.
 *
 * `autoCorrect` is off because the things typed here are school names and
 * Kenyan place names, which autocorrect reliably ruins.
 */
export function SearchBar({
  value, onChangeText, placeholder,
}: {
  readonly value: string;
  readonly onChangeText: (next: string) => void;
  readonly placeholder: string;
}) {
  return (
    <View
      style={{ borderRadius: radius.pill, minHeight: HIT_TARGET_MIN }}
      className="flex-row items-center gap-2.5 border border-border bg-card px-4"
    >
      <Feather name="search" size={15} color={colors.mutedForeground} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.disabledForeground}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        accessibilityLabel={placeholder}
        style={{ flex: 1, color: colors.foreground, fontSize: 14, paddingVertical: 10 }}
      />
      {value.length === 0 ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={12}
          onPress={() => onChangeText('')}
        >
          <Feather name="x" size={15} color={colors.mutedForeground} />
        </Pressable>
      )}
    </View>
  );
}

/** Square school mark. Flat grey; indigo is not spent here. */
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
      className="items-center justify-center bg-primarySurface"
    >
      <Text style={{ fontSize: Math.round(size * 0.34), color: colors.primary }} className="font-medium">
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
      style={{ borderRadius: CARD_RADIUS, ...SQUIRCLE }}
      className="flex-row items-center gap-2.5 border border-border bg-card px-4 py-3"
    >
      <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: STATUS[tone].fill }} />
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

/**
 * The width a column of content is allowed to reach.
 *
 * On a phone this changes nothing — every handset is narrower. It matters on
 * tablets and in the web build, where a card stretched to 1200px puts the
 * match score so far from the job title that they stop reading as one row.
 */
export const CONTENT_MAX_WIDTH = 620;

/** Spread into a `contentContainerStyle` to centre a list within that width. */
export const centredContent = {
  width: '100%',
  maxWidth: CONTENT_MAX_WIDTH,
  alignSelf: 'center',
} as const;

/** Numbers that sit in a column or update in place align by figure. */
export const tabularNums = { fontVariant: ['tabular-nums' as const] };

/**
 * react-native-web's Switch reads two colour props React Native's own types do
 * not declare, and falls back to its built-in teal for the ON thumb when they
 * are missing — which is how a switch ends up teal in a palette that has no
 * teal in it. Native ignores these; only the web build needs them.
 */
const WEB_SWITCH_COLOURS = Platform.OS === 'web'
  ? { activeThumbColor: colors.card, activeTrackColor: colors.primary }
  : {};

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
        {...WEB_SWITCH_COLOURS}
        // The row already handles the press; the switch must not fire twice.
        pointerEvents="none"
      />
    </Pressable>
  );
}
