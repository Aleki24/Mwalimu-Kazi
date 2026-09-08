import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Link } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatLabel, formatPhoneForDisplay } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { Avatar, Badge, Card, ErrorBanner, Tag, ToggleRow } from '../../components/ui';
import { useAuth, useTeacher } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { playNotificationSound, setNotificationSound } from '../../lib/sound';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const teacher = useTeacher();
  const { session, refreshProfile, signOut } = useAuth();
  const [open, setOpen] = useState(teacher.openToOpportunities);
  const [sound, setSound] = useState(teacher.notificationSound);
  const [error, setError] = useState<string | null>(null);

  const email = (session?.user.email ?? '').trim();
  const phone = (session?.user.phone ?? '').trim();
  const signedInAs = email !== '' ? email
    : phone !== '' ? formatPhoneForDisplay(`+${phone.replace(/^\+/, '')}`)
    : null;

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

          {/*
            Two destinations, not one settings blob. Editing who you are and
            writing a CV are different jobs done at different times.
          */}
          {([
            { href: '/profile/edit', icon: 'user', label: 'Edit profile',
              hint: 'Name, subjects, county, TSC number' },
            { href: '/profile/cv', icon: 'file-text', label: 'Your CV',
              hint: 'Build it once, download as PDF or Word' },
            // Not a separate account type: a head of department is often also
            // a teacher looking for their own next role.
            { href: '/recruiter', icon: 'briefcase', label: 'For schools',
              hint: 'Post roles and see who applied' },
          ] as const).map((item) => (
            <Link key={item.href} href={item.href} asChild>
              <Pressable accessibilityRole="link">
                <Card className="flex-row items-center gap-3 p-3.5">
                  <View
                    style={{ borderRadius: 999 }}
                    className="h-9 w-9 items-center justify-center bg-wash"
                  >
                    <Feather name={item.icon} size={15} color={colors.foreground} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[13px] font-medium text-foreground">{item.label}</Text>
                    <Text className="mt-0.5 text-[11.5px] text-mutedForeground">{item.hint}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Card>
              </Pressable>
            </Link>
          ))}

          <Card className="p-3.5">
            <ToggleRow
              label="Open to opportunities"
              hint="Verified schools can find your profile"
              value={open}
              onValueChange={(next) => void toggleOpen(next)}
            />
          </Card>

          <Card className="p-3.5">
            <ToggleRow
              label="Notification sound"
              hint="Play a tone for job matches and replies"
              value={sound}
              onValueChange={(next) => void toggleSound(next)}
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
            {/*
              Supabase returns an empty string rather than undefined for a
              field a user does not have, so these are checked for blankness
              rather than for undefined — an `=== undefined` guard here once
              rendered a bare "+" from an empty phone number.
            */}
            <Text className="mt-1 text-[11.5px] text-mutedForeground">
              {signedInAs ?? 'Signed in'}
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
