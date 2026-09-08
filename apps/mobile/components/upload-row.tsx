import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors, HIT_TARGET_MIN, radius, STATUS } from '@mwalimu/ui';

/**
 * What the app knows about one required document.
 *
 * A discriminated union rather than `{ uploaded: boolean; fileName?: string }`
 * because those two fields can contradict each other and this cannot: if the
 * row is uploaded it has a file name, and if it is empty there is nothing to
 * read off it.
 */
export type UploadState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'uploading'; readonly fileName: string }
  | { readonly kind: 'uploaded'; readonly fileName: string; readonly meta?: string }
  | { readonly kind: 'failed'; readonly reason: string };

/**
 * One document row on the application form.
 *
 * The empty state carries a dashed border and the filled state a solid one, so
 * "what is still missing" survives being read in a hurry, in sunlight, without
 * relying on the green tick alone.
 */
export function UploadRow({
  label,
  required = true,
  state,
  onPress,
}: {
  readonly label: string;
  readonly required?: boolean;
  readonly state: UploadState;
  readonly onPress: () => void;
}) {
  const empty = state.kind === 'empty';
  const failed = state.kind === 'failed';

  const detail =
    state.kind === 'uploaded' ? (state.meta ?? state.fileName)
    : state.kind === 'uploading' ? `Uploading ${state.fileName}…`
    : state.kind === 'failed' ? state.reason
    : required ? 'Required · PDF or DOCX' : 'Optional · PDF or DOCX';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${detail}`}
      onPress={onPress}
      style={{
        minHeight: HIT_TARGET_MIN + 12,
        borderRadius: radius.xl,
        borderCurve: 'continuous',
        borderWidth: empty ? 1.5 : 1,
        borderStyle: empty ? 'dashed' : 'solid',
        borderColor:
          failed ? colors.destructive
          : empty ? colors.input
          : colors.border,
        backgroundColor: empty ? 'transparent' : colors.card,
      }}
      className="flex-row items-center gap-3 px-3.5 py-3"
    >
      <UploadMark state={state} />

      <View className="min-w-0 flex-1">
        <Text numberOfLines={1} className="text-[13.5px] font-medium text-foreground">{label}</Text>
        <Text
          numberOfLines={1}
          style={{ color: failed ? colors.destructiveForeground : colors.mutedForeground }}
          className="mt-0.5 text-[11.5px]"
        >
          {detail}
        </Text>
      </View>

      <Feather
        name={empty ? 'plus' : failed ? 'refresh-cw' : 'more-horizontal'}
        size={16}
        color={empty ? colors.mutedForeground : colors.mutedForeground}
      />
    </Pressable>
  );
}

/** The leading disc. Green tick when done — the only green on the form. */
function UploadMark({ state }: { readonly state: UploadState }) {
  const { icon, tint, surface } =
    state.kind === 'uploaded' ? { icon: 'check' as const, tint: STATUS.success.text, surface: STATUS.success.surface }
    : state.kind === 'failed' ? { icon: 'alert-circle' as const, tint: STATUS.danger.text, surface: STATUS.danger.surface }
    : state.kind === 'uploading' ? { icon: 'upload' as const, tint: STATUS.primary.text, surface: STATUS.primary.surface }
    : { icon: 'file-text' as const, tint: colors.disabledForeground, surface: colors.wash };

  return (
    <View
      style={{ width: 34, height: 34, borderRadius: radius.pill, backgroundColor: surface }}
      className="items-center justify-center"
    >
      <Feather name={icon} size={15} color={tint} />
    </View>
  );
}
