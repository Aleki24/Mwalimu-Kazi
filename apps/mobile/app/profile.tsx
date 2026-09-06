import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatLabel, formatPhoneForDisplay } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { Avatar, Badge, Card, ErrorBanner, Tag } from '../components/ui';
import { useAuth, useTeacher } from '../lib/auth';
import { supabase } from '../lib/supabase';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const teacher = useTeacher();
  const { session, refreshProfile, signOut } = useAuth();
  const [open, setOpen] = useState(teacher.openToOpportunities);
  const [error, setError] = useState<string | null>(null);

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
              {session?.user.phone === undefined
                ? 'Signed in'
                : formatPhoneForDisplay(`+${session.user.phone.replace(/^\+/, '')}`)}
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
