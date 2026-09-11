import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@mwalimu/ui';
import { Card } from './ui';

/**
 * One section of a long form, folded away until it is wanted.
 *
 * The CV editor asks for eleven different things. Laid out end to end that is
 * a page nobody scrolls to the bottom of, and the section you want is always
 * the one below the fold. Collapsed, the whole shape of the task fits on one
 * screen and you open the part you are working on.
 *
 * Every section starts closed, with one deliberate exception the caller makes
 * for the preview: the preview is not a question, it is the answer, and hiding
 * the document behind a tap on the screen whose purpose is producing that
 * document would be perverse.
 *
 * `summary` is what makes a closed section useful rather than merely tidy — a
 * chevron alone tells you nothing about whether you have filled anything in,
 * so a closed row says "4 added" or "Not filled in" and you can see where you
 * are without opening anything.
 */
export function CollapsibleSection({
  title, summary, defaultOpen = false, children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={`px-3.5 ${open ? 'py-3' : 'py-0.5'}`}>
      <Pressable
        accessibilityRole="button"
        /*
          `aria-expanded` and not `accessibilityState={{ expanded }}`: React
          Native Web maps checked, disabled, selected and busy from
          accessibilityState and drops `expanded` entirely, so the attribute
          never reached the DOM and nothing could tell the row was a
          disclosure. React Native reads the aria-* form on both platforms.
        */
        aria-expanded={open}
        accessibilityLabel={`${title}${summary === undefined ? '' : `, ${summary}`}`}
        onPress={() => setOpen((v) => !v)}
        // The whole row is the target, not the chevron: a 13px icon is a
        // cruel thing to ask a thumb to find.
        className="min-h-[44px] flex-row items-center gap-3 py-2"
      >
        <Text className="min-w-0 flex-1 text-[12.5px] font-medium text-foreground">{title}</Text>
        {summary === undefined || open ? null : (
          <Text className="text-[11px] text-mutedForeground">{summary}</Text>
        )}
        <Feather
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.mutedForeground}
        />
      </Pressable>

      {open ? <View className="gap-2.5 pb-1">{children}</View> : null}
    </Card>
  );
}
