import { Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { reviewPromptFor } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { Card } from './ui';
import type { ReviewInvitation } from '../lib/reviews';

/**
 * Asking the one person who can answer.
 *
 * There were no reviews in this app at all, and the reason was never the form
 * — it works, and it is careful. The reason was that reaching it meant
 * thinking of a school, searching for it, opening its page and noticing a
 * link. So the thing the app has that a WhatsApp group does not was an empty
 * shelf on every school page.
 *
 * This is the question, put where the person already is. It only ever appears
 * for somebody the database says has been inside that school's hiring — on the
 * staff, interviewed, or answered — so it is never a prompt to invent an
 * opinion, which is the failure mode that makes review sites worthless.
 */
export function ReviewPrompt({ invitation }: { invitation: ReviewInvitation }) {
  const because = reviewPromptFor(invitation.reason);
  // A reason this build does not know how to phrase. Render nothing rather
  // than a card that explains itself badly.
  if (because === null) return null;

  return (
    <Link
      href={{
        pathname: '/review/new',
        params: {
          schoolId: invitation.schoolId,
          schoolName: invitation.schoolName,
          // Saves somebody recalling the exact wording of a vacancy from three
          // weeks ago. Still editable — they may have applied for one thing
          // and been interviewed for another.
          ...(invitation.roleTitle === null ? {} : { roleTitle: invitation.roleTitle }),
        },
      }}
      asChild
    >
      <Pressable accessibilityRole="link">
        <Card className="flex-row items-center gap-3 p-3.5">
          <Feather name="edit-3" size={15} color={colors.primary} />
          <View className="min-w-0 flex-1">
            <Text className="text-[13px] font-medium text-foreground">
              What was {invitation.schoolName} like?
            </Text>
            {/*
              Two lines, then an ellipsis. Unbounded, this ran to three or four
              and pushed the card taller than everything around it — and the
              last line finished under the chevron.
            */}
            <Text numberOfLines={2} className="mt-1 text-[11.5px] leading-4 text-mutedForeground">
              {because} Teachers deciding whether to apply there have nothing to read yet.
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Card>
      </Pressable>
    </Link>
  );
}
