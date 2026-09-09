import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link, Stack, router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { formatLabel } from '@mwalimu/core';
import { County, Curriculum, SchoolType } from '@mwalimu/types';
import { colors } from '@mwalimu/ui';
import { Button, Card, centredContent, Chip, ErrorBanner, NoticeStrip, SchoolMark } from '../../components/ui';
import { useTeacher } from '../../lib/auth';
import { createSchool, fetchMySchools, type MySchool } from '../../lib/recruiter';

export default function RecruiterHome() {
  const insets = useSafeAreaInsets();
  useTeacher(); // Recruiting is something a signed-in person does, not a role.

  const [schools, setSchools] = useState<readonly MySchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [name, setName] = useState('');
  const [county, setCounty] = useState<County>('nairobi');
  const [schoolType, setSchoolType] = useState<SchoolType>('private');
  const [curricula, setCurricula] = useState<readonly Curriculum[]>([]);

  const load = useCallback(async () => {
    try {
      setSchools(await fetchMySchools());
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your schools');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await createSchool({ name, county, schoolType, curricula });
      setAdding(false);
      setName('');
      await load();
      router.push({ pathname: '/recruiter/[schoolId]', params: { schoolId: id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add the school');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'For schools' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32, ...centredContent }}
        keyboardShouldPersistTaps="handled"
      >
        {error !== null ? <ErrorBanner message={error} /> : null}

        {loading ? (
          <ActivityIndicator color={colors.mutedForeground} className="py-8" />
        ) : (
          schools.map((s) => (
            <Link
              key={s.school.id}
              href={{ pathname: '/recruiter/[schoolId]', params: { schoolId: s.school.id } }}
              asChild
            >
              <Pressable accessibilityRole="link">
                <Card className="flex-row items-center gap-3 p-3.5">
                  <SchoolMark name={s.school.name} size={40} />
                  <View className="min-w-0 flex-1">
                    <Text className="text-[13px] font-medium text-foreground">{s.school.name}</Text>
                    <Text className="mt-0.5 text-[11.5px] text-mutedForeground">
                      {formatLabel(s.school.county)} · {s.openRoles} open{' '}
                      {s.openRoles === 1 ? 'role' : 'roles'}
                      {s.newApplicants > 0 ? ` · ${s.newApplicants} to review` : ''}
                    </Text>
                    {s.school.verification === 'verified' ? null : (
                      <Text className="mt-0.5 text-[11px] text-warningForeground">
                        Unverified — teachers are told
                      </Text>
                    )}
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Card>
              </Pressable>
            </Link>
          ))
        )}

        {!loading && schools.length === 0 && !adding ? (
          <Card className="gap-2 p-3.5">
            <Text className="text-[13px] font-medium text-foreground">
              Hiring for a school?
            </Text>
            <Text className="text-[11.5px] leading-4 text-mutedForeground">
              Add it, post your vacancies, and see who applies — with each applicant scored
              against the role by the same matcher the teacher saw.
            </Text>
          </Card>
        ) : null}

        {adding ? (
          <Card className="gap-3 p-3.5">
            <Text className="text-[12.5px] font-medium text-foreground">Add your school</Text>

            <View className="gap-1.5">
              <Text className="text-[11.5px] text-mutedForeground">Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Greenfield Academy"
                placeholderTextColor={colors.mutedForeground}
                className="h-11 rounded-md border border-border bg-card px-3 text-[14px] text-foreground"
              />
            </View>

            <View className="gap-1.5">
              <Text className="text-[11.5px] text-mutedForeground">Type</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {SchoolType.options.map((t) => (
                  <Chip key={t} label={formatLabel(t)} selected={schoolType === t} onPress={() => setSchoolType(t)} />
                ))}
              </View>
            </View>

            <View className="gap-1.5">
              <Text className="text-[11.5px] text-mutedForeground">Curricula</Text>
              <View className="flex-row flex-wrap gap-1.5">
                {Curriculum.options.map((c) => (
                  <Chip
                    key={c}
                    label={formatLabel(c)}
                    selected={curricula.includes(c)}
                    onPress={() => setCurricula(
                      curricula.includes(c) ? curricula.filter((x) => x !== c) : [...curricula, c],
                    )}
                  />
                ))}
              </View>
            </View>

            <View className="gap-1.5">
              <Text className="text-[11.5px] text-mutedForeground">County</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {County.options.map((c) => (
                  <Chip key={c} label={formatLabel(c)} selected={county === c} onPress={() => setCounty(c)} />
                ))}
              </ScrollView>
            </View>

            <NoticeStrip tone="warning">
              <Text className="text-[11.5px] leading-4 text-mutedForeground">
                New schools start unverified, and teachers see that on your listings. Verification
                is done by us, not claimed here — that is what makes the badge worth anything.
              </Text>
            </NoticeStrip>

            {busy ? (
              <ActivityIndicator color={colors.mutedForeground} className="py-2" />
            ) : (
              <Button label="Add school" disabled={name.trim().length < 2} onPress={() => void submit()} />
            )}
          </Card>
        ) : (
          <Button
            label={schools.length === 0 ? 'Add your school' : 'Add another school'}
            variant={schools.length === 0 ? 'primary' : 'secondary'}
            onPress={() => setAdding(true)}
          />
        )}
      </ScrollView>
    </View>
  );
}
