import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { parseTeacherProfile, type CvData } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { Card, centredContent, EmptyState, ErrorBanner, NoticeStrip } from '../../../components/ui';
import { CvPreview } from '../../../components/cv-preview';
import { supabase } from '../../../lib/supabase';
import { fetchCv, fetchPhotoDataUri, toCvData } from '../../../lib/cv';

/**
 * Somebody else's CV.
 *
 * The same renderer the teacher used to build it, reading through the same
 * policies — there is no privileged path here and no service key. If this
 * teacher set their CV to "Only me", the queries below come back empty and the
 * screen says so; the decision is theirs and the database is what enforces it,
 * not this file.
 *
 * Referees are held back by policy from anyone the teacher has not actually
 * applied to, so a browsing recruiter sees a CV with no referees on it rather
 * than a list of phone numbers nobody consented to publish.
 */
export default function ApplicantCvScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cv, setCv] = useState<CvData | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [profileRow, record] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
          fetchCv(id),
        ]);
        if (profileRow.error !== null) throw new Error(profileRow.error.message);
        if (profileRow.data === null) {
          if (!cancelled) setCv(null);
          return;
        }
        const parsed = parseTeacherProfile(profileRow.data);
        if (!parsed.ok) throw new Error('That profile could not be read.');
        if (!cancelled) setName(parsed.value.fullName);

        // No `cv_details` row means either nothing was ever filled in or the
        // policy refused it. Either way there is no document to show, and
        // guessing which would mean telling a recruiter something about a
        // teacher's settings that is not theirs to know.
        if (record.details === null) {
          if (!cancelled) setCv(null);
          return;
        }
        const photo = await fetchPhotoDataUri(record.details.photo_path);
        if (!cancelled) setCv(toCvData(parsed.value, record, photo));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not open that CV');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: name ?? 'CV' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, ...centredContent }}>
        {error !== null ? <ErrorBanner message={error} /> : null}

        {loading ? (
          <ActivityIndicator color={colors.mutedForeground} className="py-10" />
        ) : cv === null ? (
          <EmptyState
            title="No CV to show"
            body={`${name ?? 'This teacher'} has not shared a CV here. You can still message them and ask for one.`}
          />
        ) : (
          <>
            <NoticeStrip>
              <Text className="text-[11.5px] leading-4 text-mutedForeground">
                Shared with you by {name}. Treat it as you would a CV they emailed you.
              </Text>
            </NoticeStrip>
            <Card className="p-2">
              <CvPreview cv={cv} template="portrait" />
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}
