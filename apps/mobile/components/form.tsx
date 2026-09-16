import { useState, type ReactNode } from 'react';
import { Platform, Pressable, Text, TextInput, View, type TextStyle } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors, radius } from '@mwalimu/ui';

/**
 * The form vocabulary the CV editor is built from.
 *
 * Two decisions worth writing down:
 *
 * **Fields pair up when there is room.** A phone number and an email each need
 * about a third of a line and were each given a whole one, so a CV editor read
 * as a column of a dozen boxes — on a desktop, a column of a dozen boxes down
 * the middle of a wide empty page. Every field declares a basis rather than a
 * width, and the row wraps: two columns wherever two fit, one where they do
 * not. No width listener, no breakpoint, and the same code on a phone and in
 * a browser.
 *
 * **A field is filled, not outlined.** Resting fields are ink at 4% with no
 * border, so a long form reads as a surface with writing on it rather than as
 * a stack of empty boxes; the one being typed into turns white and takes the
 * indigo ring. That is the only moment a field is allowed to be loud.
 */

/** How narrow a field may get before the row wraps instead. */
const FIELD_BASIS = 200;

/**
 * The browser's own focus ring, turned off in favour of ours.
 *
 * A focused field here already turns white and takes the indigo ring, so the
 * user-agent outline is a second, squarer ring drawn on top of the first — and
 * it is black, which this palette does not contain. Focus stays visible, so
 * the accessibility requirement is met by the style below rather than lost.
 *
 * Cast because `outlineStyle` is a react-native-web property React Native's own
 * types do not declare; the same trick, for the same reason, as the Switch
 * colours in `ui.tsx`. Native platforms ignore the key.
 */
export const NO_WEB_OUTLINE: TextStyle = Platform.OS === 'web'
  ? ({ outlineStyle: 'none' } as unknown as TextStyle)
  : {};

export type FieldSpan = 'half' | 'full';

const spanStyle = (span: FieldSpan) => ({
  flexBasis: span === 'full' ? ('100%' as const) : FIELD_BASIS,
  flexGrow: 1,
  // Without this a long placeholder sets the basis and the pair never wraps.
  minWidth: 0,
});

/**
 * Full width without the row-flex properties, for a field that is not in a row.
 *
 * `spanStyle` is written for `FieldGrid`, which is a flex *row*: there
 * `flexBasis: '100%'` means the whole width and `flexGrow: 1` fills the line.
 * Every multiline field in the CV editor sits outside a FieldGrid, as a direct
 * child of the section's column — and in a column those same two properties
 * are read against the main axis, so the basis became 100% of the section's
 * *height* and the box grew to fill whatever was left.
 *
 * It was not subtle. The description box on every entry form rendered about
 * 650px tall, and the form's own Add button was pushed past the bottom of its
 * card and painted underneath the next one, where a teacher could not click it
 * — so no role, qualification, certificate, referee or volunteer entry could
 * be added at all. `width` does the same job in a row and means nothing in a
 * column, which is why it is the one to use here.
 */
const FULL_WIDTH = {
  width: '100%' as const,
  flexGrow: 0,
  flexShrink: 0,
  minWidth: 0,
};

/** The row fields sit in. Anything inside it pairs up when the width allows. */
export function FieldGrid({ children }: { readonly children: ReactNode }) {
  return <View className="flex-row flex-wrap gap-x-2.5 gap-y-3">{children}</View>;
}

export function Field({
  label, value, onChangeText, placeholder, keyboardType, multiline = false,
  maxLength, hint, span = 'half', invalid = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (next: string) => void;
  readonly placeholder?: string;
  readonly keyboardType?: 'default' | 'number-pad' | 'email-address' | 'phone-pad';
  readonly multiline?: boolean;
  readonly maxLength?: number;
  readonly hint?: string;
  readonly span?: FieldSpan;
  /** Draws the field in coral. The caller still says what is wrong, in `hint`. */
  readonly invalid?: boolean;
}) {
  // Focus is tracked rather than left to a `:focus` rule: nativewind's focus
  // variant is web-only, and this app ships to three platforms from one file.
  const [focused, setFocused] = useState(false);

  const border = invalid ? colors.destructive : focused ? colors.ring : 'transparent';

  return (
    <View style={multiline ? FULL_WIDTH : spanStyle(span)} className="gap-1.5">
      <Text className="text-[11.5px] font-medium text-mutedForeground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.disabledForeground}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline}
        maxLength={maxLength}
        accessibilityLabel={label}
        textAlignVertical={multiline ? 'top' : 'center'}
        style={{
          ...NO_WEB_OUTLINE,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: border,
          backgroundColor: focused ? colors.card : colors.wash,
          color: colors.foreground,
          fontSize: 14,
          paddingHorizontal: 12,
          paddingVertical: multiline ? 10 : 0,
          minHeight: multiline ? 96 : 44,
        }}
      />
      {hint === undefined ? null : (
        <Text
          style={invalid ? { color: colors.destructiveForeground } : undefined}
          className="text-[10.5px] leading-4 text-mutedForeground"
        >
          {hint}
        </Text>
      )}
    </View>
  );
}

/**
 * A field this screen does not own.
 *
 * Name, headline and TSC number print on the CV but live on the profile,
 * because the matcher reads them and a CV that disagreed with the profile a
 * school matched on would be worse than no CV. Showing them greyed out with a
 * way through beats leaving a hole where a teacher expects their own name —
 * which is what the editor did, under a notice at the top that explained it to
 * anyone still reading by then.
 */
export function ReadOnlyField({
  label, value, placeholder, onPress, span = 'half',
}: {
  readonly label: string;
  readonly value: string;
  readonly placeholder: string;
  readonly onPress: () => void;
  readonly span?: FieldSpan;
}) {
  const blank = value.trim() === '';
  return (
    <View style={spanStyle(span)} className="gap-1.5">
      <Text className="text-[11.5px] font-medium text-mutedForeground">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${blank ? placeholder : value}. Edit on your profile.`}
        onPress={onPress}
        style={{ borderRadius: radius.lg, minHeight: 44 }}
        className="flex-row items-center gap-2 bg-wash px-3"
      >
        <Text
          numberOfLines={1}
          className={`min-w-0 flex-1 text-[14px] ${blank ? 'text-disabledForeground' : 'text-foreground/70'}`}
        >
          {blank ? placeholder : value}
        </Text>
        <Feather name="edit-2" size={12} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}
