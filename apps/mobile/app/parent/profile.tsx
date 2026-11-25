import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatLabel, formatPhoneForDisplay } from '@mwalimu/core';
import { County } from '@mwalimu/types';
import { Avatar, Card, Chip, centredContent, ErrorBanner, ToggleRow } from '../../components/ui';
import { useAuth, useParent } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { playNotificationSound, setNotificationSound } from '../../lib/sound';

/**
 * A parent's whole profile: their name, their county, and whether the app
 * makes a sound.
 *
 * Three fields, and that is the point. The teacher's profile screen carries
 * subjects, a TSC number, a CV, a recruiter desk and an "open to
 * opportunities" switch, none of which mean anything to somebody looking for
 * a tutor for their daughter. County is here because it is the one thing that
 * changes which tutors they are shown.
 */
export default function ParentProfileScreen() {
  const parent = useParent();
  const { session, refreshProfile, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const [county, setCounty] = useState(parent.county);
  const [sound, setSound] = useState(parent.notificationSound);
  const [error, setError] = useState<string | null>(null);

  const email = (session?.user.email ?? '').trim();
  const phone = (session?.user.phone ?? '').trim();
  const signedInAs = email !== '' ? email
    : phone !== '' ? formatPhoneForDisplay(`+${phone.replace(/^\+/, '')}`)
    : null;

  const moveTo = async (next: County) => {
    const previous = county;
    setCounty(next); // optimistic: a chip that lags reads as broken
    const { error: updateError } = await supabase
      .from('profiles').update({ county: next }).eq('id', parent.id);
    if (updateError !== null) {
      setCounty(previous);
      setError(updateError.message);
      return;
    }
    setError(null);
    await refreshProfile();
  };

  const toggleSound = async (next: boolean) => {
    setSound(next);
    if (next) void playNotificationSound(true);
    try {
      await setNotificationSound(parent.id, next);
    } catch (cause) {
      setSound(!next);
      setError(cause instanceof Error ? cause.message : 'Could not save that');
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Your details' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32, ...centredContent }}
      >
        <Card className="flex-row items-center gap-3.5 p-4">
          <Avatar name={parent.fullName} size={56} />
          <View className="min-w-0 flex-1">
            <Text className="text-[18px] font-medium tracking-tight text-foreground">
              {parent.fullName}
            </Text>
            <Text className="mt-0.5 text-[12.5px] text-mutedForeground">
              {signedInAs ?? 'Signed in'}
            </Text>
          </View>
        </Card>

        {error !== null ? <ErrorBanner message={error} /> : null}

        <Card className="gap-2.5 p-4">
          <Text className="text-[13px] font-medium text-foreground">Where you are</Text>
          <Text className="text-[11.5px] leading-4 text-mutedForeground">
            Tutors are shown to you nearest first. Changing this changes who you see.
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {County.options.map((c) => (
              <Chip
                key={c}
                label={formatLabel(c)}
                selected={county === c}
                onPress={() => void moveTo(c)}
              />
            ))}
          </ScrollView>
        </Card>

        <Card className="p-4">
          <ToggleRow
            label="Notification sound"
            hint="Play a tone when a teacher answers you"
            value={sound}
            onValueChange={(next) => void toggleSound(next)}
          />
        </Card>

        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          className="h-12 items-center justify-center rounded-md border border-border bg-card"
        >
          <Text className="text-[14px] font-medium text-destructiveForeground">Sign out</Text>
        </Pressable>

        <Text className="px-1 text-[11px] leading-4 text-mutedForeground">
          Signed up as a teacher by mistake, or the other way round? Message us and we will
          move the account over — it is one field, but it is not one you should be able to
          flip by accident.
        </Text>
      </ScrollView>
    </View>
  );
}
