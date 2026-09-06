import type { ReactNode } from 'react';
import { Text, View, type ViewProps } from 'react-native';
import { HIT_TARGET_MIN } from '@mwalimu/ui';

/**
 * The primitives the job screens are built from. Anatomy follows the mockups:
 * cards are r16 with a 1px border, badges are 11px/700 pills.
 */

export function Card({ children, className = '', ...rest }: ViewProps & { children: ReactNode }) {
  return (
    <View className={`rounded-lg border border-border bg-card p-4 ${className}`} {...rest}>
      {children}
    </View>
  );
}

const BADGE_TONES = {
  brand: 'bg-primarySoft text-primary',
  success: 'bg-successBg text-success',
  danger: 'bg-dangerBg text-danger',
  warning: 'bg-warningBg text-warning',
  info: 'bg-infoBg text-info',
  neutral: 'bg-mutedBg text-muted',
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const [bg, fg] = BADGE_TONES[tone].split(' ') as [string, string];
  return (
    <View className={`self-start rounded-full px-2 py-1 ${bg}`}>
      <Text className={`text-[11px] font-bold ${fg}`}>{label}</Text>
    </View>
  );
}

/** Filter chip. Meets the 44dp touch floor — the mockups' chips did not. */
export function Chip({ label, selected = false }: { label: string; selected?: boolean }) {
  return (
    <View
      style={{ minHeight: HIT_TARGET_MIN }}
      className={`justify-center rounded-full border px-3.5 ${
        selected ? 'border-primary bg-primary' : 'border-border bg-card'
      }`}
    >
      <Text className={`text-xs font-semibold ${selected ? 'text-white' : 'text-muted'}`}>
        {label}
      </Text>
    </View>
  );
}

/** Square school mark, standing in for a logo. */
export function SchoolMark({ name, size = 40 }: { name: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={{ width: size, height: size }}
      className="items-center justify-center rounded-md bg-primarySoft"
    >
      <Text style={{ fontSize: Math.round(size * 0.4) }} className="font-extrabold text-primaryDark">
        {initial}
      </Text>
    </View>
  );
}

export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="border-b border-border bg-card px-4 pb-3.5 pt-2">
      <Text className="text-2xl font-extrabold tracking-tight text-foreground">{title}</Text>
      {subtitle !== undefined ? (
        <Text className="mt-0.5 text-[13px] text-muted">{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View className="items-center px-6 py-14">
      <Text className="text-[15px] font-bold text-foreground">{title}</Text>
      <Text className="mt-1 text-center text-[13px] text-muted">{body}</Text>
    </View>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View className="mb-4 rounded-md border border-danger bg-dangerBg p-3">
      <Text className="text-[13px] text-danger">{message}</Text>
    </View>
  );
}
