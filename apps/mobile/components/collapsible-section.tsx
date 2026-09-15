import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@mwalimu/ui';
import { Card } from './ui';

/**
 * One section of a long form, folded away until it is wanted.
 *
 * The CV editor asks for nine different things. Laid out end to end that is a
 * page nobody scrolls to the bottom of, and the section you want is always the
 * one below the fold. Collapsed, the whole shape of the task fits on one
 * screen and you open the part you are working on.
 *
 * `summary` is what makes a closed section useful rather than merely tidy — a
 * chevron alone tells you nothing about whether you have filled anything in,
 * so a closed row says "4 added" or "Not filled in" and you can see where you
 * are without opening anything.
 *
 * `status` is the next step on from that: a mark in the margin saying whether
 * this section is done, still owed, or merely optional. Reading a column of
 * summaries and working out which ones matter is the job the checklist at the
 * top of the screen does for you — this is the same answer, in place.
 *
 * Open state can be the caller's. Left alone the section owns it; passed in,
 * the screen does, which is how tapping "Add a role" on the checklist opens
 * the right fold and closes the others.
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
function StatusMark({ status }: { readonly status: SectionStatus }) {
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

export function CollapsibleSection({
  title, summary, why, status, defaultOpen = false, open, onOpenChange, children,
}: {
  readonly title: string;
  readonly summary?: string;
  /** One line on what this section does for the teacher, shown when open. */
  readonly why?: string;
  readonly status?: SectionStatus;
  readonly defaultOpen?: boolean;
  /** Supply with `onOpenChange` to let the screen drive which fold is open. */
  readonly open?: boolean;
  readonly onOpenChange?: (next: boolean) => void;
  readonly children: ReactNode;
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = open ?? internalOpen;

  const toggle = () => {
    const next = !isOpen;
    // Only the uncontrolled copy is written here. Writing both would leave the
    // section briefly disagreeing with the screen that owns it.
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <Card className={`px-3.5 ${isOpen ? 'py-3' : 'py-0.5'}`}>
      <Pressable
        accessibilityRole="button"
        /*
          `aria-expanded` and not `accessibilityState={{ expanded }}`: React
          Native Web maps checked, disabled, selected and busy from
          accessibilityState and drops `expanded` entirely, so the attribute
          never reached the DOM and nothing could tell the row was a
          disclosure. React Native reads the aria-* form on both platforms.
        */
        aria-expanded={isOpen}
        accessibilityLabel={[
          title,
          summary,
          status === undefined ? undefined : status.done ? 'done' : 'not filled in',
        ].filter((part) => part !== undefined).join(', ')}
        onPress={toggle}
        // The whole row is the target, not the chevron: a 13px icon is a
        // cruel thing to ask a thumb to find.
        className="min-h-[44px] flex-row items-center gap-2.5 py-2"
      >
        {status === undefined ? null : <StatusMark status={status} />}
        <Text className="min-w-0 flex-1 text-[12.5px] font-medium text-foreground">{title}</Text>
        {summary === undefined || isOpen ? null : (
          <Text className="text-[11px] text-mutedForeground">{summary}</Text>
        )}
        <Feather
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.mutedForeground}
        />
      </Pressable>

      {isOpen ? (
        <View className="gap-2.5 pb-1">
          {why === undefined ? null : (
            <Text className="text-[11px] leading-4 text-mutedForeground">{why}</Text>
          )}
          {children}
        </View>
      ) : null}
    </Card>
  );
}
