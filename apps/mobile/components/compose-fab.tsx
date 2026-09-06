import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { colors, radius, shadow } from '@mwalimu/ui';

/**
 * The plus button, and the sheet it opens.
 *
 * Two things can be created and they are not the same act — a post is chat, a
 * vacancy is a commitment someone will send their documents to. One button
 * that guessed which you meant would get it wrong, so it asks.
 */
const CHOICES = [
  {
    href: '/post/new',
    icon: 'briefcase',
    label: 'Post a role',
    hint: 'A vacancy teachers can apply to',
  },
  {
    href: '/feed',
    icon: 'edit-2',
    label: 'Write a post',
    hint: 'Ask the staffroom, or share something',
  },
] as const satisfies ReadonlyArray<{
  href: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  hint: string;
}>;

export function ComposeFab() {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create"
        onPress={() => setOpen(true)}
        style={{
          position: 'absolute',
          right: 16,
          bottom: insets.bottom + 78,
          height: 52,
          width: 52,
          borderRadius: radius.pill,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          ...shadow.floating,
        }}
      >
        <Feather name="plus" size={23} color={colors.primaryForeground} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        {/* The scrim dismisses. A sheet you can only leave by choosing is a trap. */}
        <Pressable
          onPress={() => setOpen(false)}
          accessibilityLabel="Close"
          style={{ flex: 1, backgroundColor: 'rgba(41,41,41,0.35)', justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              margin: 10,
              marginBottom: Math.max(insets.bottom, 10),
              padding: 8,
              backgroundColor: colors.card,
              borderRadius: radius.xl3,
              borderCurve: 'continuous',
              ...shadow.floating,
            }}
          >
            {CHOICES.map((choice) => (
              <Pressable
                key={choice.href}
                accessibilityRole="button"
                onPress={() => { setOpen(false); router.push(choice.href); }}
                style={{ borderRadius: radius.xl, borderCurve: 'continuous' }}
                className="flex-row items-center gap-3 px-3 py-3.5"
              >
                <View
                  style={{ borderRadius: radius.pill }}
                  className="h-9 w-9 items-center justify-center bg-wash"
                >
                  <Feather name={choice.icon} size={16} color={colors.foreground} />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="text-[13.5px] font-medium text-foreground">{choice.label}</Text>
                  <Text className="text-[11.5px] text-mutedForeground">{choice.hint}</Text>
                </View>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
