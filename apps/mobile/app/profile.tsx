import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatLabel, formatPhoneForDisplay } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { Avatar, Badge, Card, ErrorBanner, Tag } from '../components/ui';
import { useAuth, useTeacher } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { playNotificationSound, setNotificationSound } from '../lib/sound';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const teacher = useTeacher();
  const { session, refreshProfile, signOut } = useAuth();
  const [open, setOpen] = useState(teacher.openToOpportunities);
  const [sound, setSound] = useState(teacher.notificationSound);
  const [error, setError] = useState<string | null>(null);

  const raw = session?.user.phone ?? '';
  const phone = raw.trim() === '' ? null : `+${raw.replace(/^\+/, '')}`;

  const toggleSound = async (next: boolean) => {
    setSound(next);
    // Play it on the way on, never on the way off. Someone turning a sound off
    // has already decided what they think of it.
    if (next) void playNotificationSound(true);
    try {
      await setNotificationSound(teacher.id, next);
    } catch (cause) {
      setSound(!next);
      setError(cause instanceof Error ? cause.message : 'Could not save that');
    }
  };

  const toggleOpen = async (next: boolean) => {
    setOpen(next); // optimistic: a toggle that lags feels broken
    const { error: updateError } = await supabase
      .from('profiles').update({ open_to_opportunities: next }).eq('id', teacher.id);

    if (updateError !== null) {
      setOpen(!next);
      setError(updateError.message);
      return;
    }
    setError(null);
    await refreshProfile();
  };


  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="bg-card px-5 pb-5 pt-3">
          <View className="flex-row items-center gap-3.5">
            <Avatar name={teacher.fullName} size={64} />
            <View className="min-w-0 flex-1">
              <Text className="text-xl font-medium tracking-tight text-foreground">{teacher.fullName}</Text>
              <Text className="mt-0.5 text-sm text-foreground/80">
                {teacher.subjects.map(formatLabel).join(' · ')}
              </Text>
              <Text className="mt-0.5 text-xs text-mutedForeground">{formatLabel(teacher.county)}</Text>
            </View>
          </View>
        </View>

        <View className="gap-3 p-4">
          {error !== null ? <ErrorBanner message={error} /> : null}

          <View className="flex-row gap-2.5">
            {[
              ['Experience', `${teacher.experienceYears} yr${teacher.experienceYears === 1 ? '' : 's'}`],
              ['Subjects', String(teacher.subjects.length)],
              ['TSC', teacher.tscVerified ? 'Verified' : teacher.tscNumber === undefined ? 'None' : 'Pending'],
            ].map(([label, value]) => (
              <Card key={label} className="flex-1 p-3">
                <Text className="text-[12px] font-medium text-mutedForeground">{label}</Text>
                <Text className="mt-0.5 text-[17px] font-medium tracking-tight text-foreground">{value}</Text>
              </Card>
            ))}
          </View>

          <Card className="flex-row items-center gap-3 p-3.5">
            <View className="flex-1">
              <Text className="text-[13px] font-medium text-foreground">Open to opportunities</Text>
              <Text className="mt-0.5 text-[11.5px] text-mutedForeground">
                Verified schools can find your profile
              </Text>
            </View>
            <Switch
              value={open}
              onValueChange={(next) => void toggleOpen(next)}
              trackColor={{ true: colors.primary, false: colors.secondary }}
              thumbColor={colors.card}
              ios_backgroundColor={colors.secondary}
            />
          </Card>

          <Card className="flex-row items-center gap-3 p-3.5">
            <View className="flex-1">
              <Text className="text-[13px] font-medium text-foreground">Notification sound</Text>
              <Text className="mt-0.5 text-[11.5px] text-mutedForeground">
                Play a tone for job matches and replies
              </Text>
            </View>
            <Switch
              value={sound}
              onValueChange={(next) => void toggleSound(next)}
              trackColor={{ true: colors.primary, false: colors.secondary }}
              thumbColor={colors.card}
              ios_backgroundColor={colors.secondary}
            />
          </Card>

          <Card className="p-3.5">
            <Text className="mb-2 text-[12.5px] font-medium text-foreground">Qualifications</Text>
            <View className="gap-1.5">
              <View className="flex-row items-center gap-2">
                <Text className={`text-[12px] ${teacher.hasDegree ? 'text-success' : 'text-mutedForeground'}`}>
                  {teacher.hasDegree ? '✓' : '○'}
                </Text>
                <Text className="flex-1 text-[12px] text-mutedForeground">
                  {teacher.hasDegree ? 'Degree on your profile' : 'No degree recorded'}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className={`text-[12px] ${teacher.tscVerified ? 'text-success' : 'text-warning'}`}>
                  {teacher.tscVerified ? '✓' : '○'}
                </Text>
                <Text className="flex-1 text-[12px] text-mutedForeground">
                  {teacher.tscNumber === undefined
                    ? 'No TSC number — TSC-only roles will not match you'
                    : `TSC No. ${teacher.tscNumber}`}
                </Text>
                {teacher.tscNumber !== undefined && !teacher.tscVerified ? (
                  <Badge label="Pending" tone="warning" />
                ) : null}
              </View>
            </View>
          </Card>

          <Card className="p-3.5">
            <Text className="mb-2 text-[12.5px] font-medium text-foreground">Subjects</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {teacher.subjects.map((s) => <Tag key={s} label={formatLabel(s)} />)}
            </View>
          </Card>

          <Card className="p-3.5">
            <Text className="text-[12.5px] font-medium text-foreground">Account</Text>
            <Text className="mt-1 text-[11.5px] text-mutedForeground">
              {/*
                Supabase returns an empty string for a user with no phone, not
                undefined, so an `=== undefined` guard fell through and rendered
                a bare "+" — the country prefix with nothing after it.
              */}
              {phone === null ? 'Signed in' : formatPhoneForDisplay(phone)}
            </Text>
          </Card>

          <Pressable
            accessibilityRole="button"
            onPress={() => void signOut()}
            className="h-12 items-center justify-center rounded-md border border-border bg-card"
          >
            <Text className="text-[14px] font-medium text-destructiveForeground">Sign out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
