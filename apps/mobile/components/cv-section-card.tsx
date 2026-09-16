import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors, radius } from '@mwalimu/ui';
import { NO_WEB_OUTLINE } from './form';
import { Card } from './ui';

/**
 * One section of the CV, as a card you write in.
 *
 * This card is a block of the document, not a fold in a form. Its heading is
 * the heading that prints, its position is the position that prints, and both
 * are changed here — tap the name to rename it, use the menu to move it. The
 * editor used to carry a separate "Sections" list for that, which was the one
 * thing on the screen that did not edit your CV, and which nobody read as
 * "this is where Employment becomes Work Experience".
 *
 * Closed, the row says what is in the section and whether anything is owed on
 * it. Open, it is a form with a heading you can correct.
 */

export interface SectionStatus {
  readonly done: boolean;
  /**
   * Whether a CV should be sent without it. An empty essential section is
   * marked amber, an empty optional one stays quiet — an app that nags equally
   * about a referee and a hobby has taught you to ignore it about both.
   */
  readonly essential: boolean;
}

/** The mark in the margin: done, owed, or take it or leave it. */
function StatusMark({ status }: { readonly status: SectionStatus | undefined }) {
  if (status === undefined) {
    return <View style={{ width: 15 }} />;
  }
  if (status.done) {
    return <Feather name="check-circle" size={15} color={colors.success} />;
  }
  return (
    <View
      style={{
        width: 13,
        height: 13,
        borderRadius: 999,
        borderWidth: 1.5,
        borderColor: status.essential ? colors.warning : colors.disabledForeground,
      }}
    />
  );
}

/** A small square control in the card's header. */
function HeaderButton({
  icon, label, onPress, disabled = false,
}: {
  readonly icon: React.ComponentProps<typeof Feather>['name'];
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ borderRadius: radius.md }}
      className="h-9 w-9 items-center justify-center"
    >
      <Feather
        name={icon}
        size={16}
        color={disabled ? colors.disabledForeground : colors.mutedForeground}
      />
    </Pressable>
  );
}

export function CvSectionCard({
  title, defaultTitle, summary, why, status, open, onOpenChange,
  onRename, onMove, canMoveUp, canMoveDown, children,
}: {
  /** The heading as it prints today — the teacher's word, or the app's. */
  readonly title: string;
  /** The app's word, offered back as "use the default name". */
  readonly defaultTitle: string;
  /** What is in it, for the closed row. */
  readonly summary: string;
  readonly why?: string;
  readonly status?: SectionStatus;
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  /** Null puts the default word back. Absent means this heading is not the teacher's to change. */
  readonly onRename?: (next: string | null) => void;
  readonly onMove?: (delta: -1 | 1) => void;
  readonly canMoveUp?: boolean;
  readonly canMoveDown?: boolean;
  readonly children: ReactNode;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const [arranging, setArranging] = useState(false);

  const arrangeable = onMove !== undefined || onRename !== undefined;

  const startRename = () => {
    if (onRename === undefined) return;
    setDraft(title);
    setRenaming(true);
  };

  const commit = () => {
    setRenaming(false);
    const wanted = draft.trim();
    // The default word rather than an empty heading: a section with no name is
    // a mistake, not a choice.
    if (wanted === '' || wanted === title) return;
    onRename?.(wanted);
  };

  const heading = renaming ? (
    <TextInput
      value={draft}
      onChangeText={setDraft}
      onBlur={commit}
      onSubmitEditing={commit}
      autoFocus
      // Selected on focus, so tapping a name and typing replaces it. Without
      // this the caret lands at the end and the new name is appended to the
      // old one — "EmploymentWork Experience".
      selectTextOnFocus
      maxLength={40}
      returnKeyType="done"
      accessibilityLabel={`Rename ${title}`}
      style={{
        ...NO_WEB_OUTLINE,
        borderRadius: radius.md,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.ring,
        color: colors.foreground,
        fontSize: 15,
        fontWeight: '500',
        paddingHorizontal: 8,
        minHeight: 36,
      }}
      className="min-w-0 flex-1"
    />
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        open && onRename !== undefined
          ? `Rename ${title}`
          : `${title}${summary === '' ? '' : `, ${summary}`}`
      }
      aria-expanded={open}
      onPress={() => (open ? startRename() : onOpenChange(true))}
      className="min-h-[44px] min-w-0 flex-1 flex-row items-center gap-1.5"
    >
      <Text
        numberOfLines={1}
        style={open && onRename !== undefined
          ? { textDecorationLine: 'underline', textDecorationStyle: 'dotted' }
          : undefined}
        className="min-w-0 shrink text-[15px] font-medium tracking-tight text-foreground"
      >
        {title}
      </Text>
      {open && onRename !== undefined ? (
        <Feather name="edit-2" size={11} color={colors.mutedForeground} />
      ) : null}
      {open || summary === '' ? null : (
        <Text numberOfLines={1} className="ml-auto pl-2 text-[11.5px] text-mutedForeground">
          {summary}
        </Text>
      )}
    </Pressable>
  );

  return (
    <Card className={`px-4 ${open ? 'py-3' : 'py-1'}`}>
      <View className="flex-row items-center gap-2.5">
        <StatusMark status={status} />
        {heading}

        {open && arrangeable ? (
          <HeaderButton
            icon="more-vertical"
            label={arranging ? 'Hide section options' : 'Section options'}
            onPress={() => setArranging((v) => !v)}
          />
        ) : null}
        <HeaderButton
          icon={open ? 'chevron-up' : 'chevron-down'}
          label={open ? `Close ${title}` : `Open ${title}`}
          onPress={() => { setArranging(false); onOpenChange(!open); }}
        />
      </View>

      {open && arranging ? (
        <View
          style={{ borderRadius: radius.lg }}
          className="mt-1 gap-2 bg-wash px-2.5 py-2"
        >
          <View className="flex-row flex-wrap items-center gap-1.5">
            {onMove === undefined ? null : (
              <>
                <ArrangeButton
                  icon="arrow-up"
                  label="Move up"
                  disabled={canMoveUp !== true}
                  onPress={() => onMove(-1)}
                />
                <ArrangeButton
                  icon="arrow-down"
                  label="Move down"
                  disabled={canMoveDown !== true}
                  onPress={() => onMove(1)}
                />
              </>
            )}
            {onRename === undefined ? null : (
              <>
                <ArrangeButton icon="edit-2" label="Rename" onPress={startRename} />
                {title === defaultTitle ? null : (
                  <ArrangeButton
                    icon="rotate-ccw"
                    label={`Call it ${defaultTitle}`}
                    onPress={() => onRename(null)}
                  />
                )}
              </>
            )}
          </View>
          <Text className="text-[10.5px] leading-4 text-mutedForeground">
            This is the heading and the position on the printed CV. A section with nothing
            in it does not print at all, so there is nothing to delete.
          </Text>
        </View>
      ) : null}

      {open ? (
        <View className="gap-3 pb-1 pt-2.5">
          {why === undefined ? null : (
            <Text className="text-[11.5px] leading-[17px] text-mutedForeground">{why}</Text>
          )}
          {children}
        </View>
      ) : null}
    </Card>
  );
}

/** A labelled pill in the arrange strip. Wide enough to read, small enough to sit in a row. */
function ArrangeButton({
  icon, label, onPress, disabled = false,
}: {
  readonly icon: React.ComponentProps<typeof Feather>['name'];
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{ borderRadius: radius.pill, minHeight: 36 }}
      className="flex-row items-center gap-1.5 bg-card px-3"
    >
      <Feather
        name={icon}
        size={12}
        color={disabled ? colors.disabledForeground : colors.foreground}
      />
      <Text
        className={`text-[11.5px] font-medium ${
          disabled ? 'text-disabledForeground' : 'text-foreground'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
