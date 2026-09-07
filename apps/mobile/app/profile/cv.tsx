import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {
  CV_TEMPLATES, CV_TEMPLATE_HINT, formatYearRange, orderEducation, orderExperience,
  type CvTemplate,
} from '@mwalimu/core';
import { colors, radius } from '@mwalimu/ui';
import { Button, Card, Chip, ErrorBanner, NoticeStrip, ToggleRow } from '../../components/ui';
import { useTeacher } from '../../lib/auth';
import {
  deleteCvEntry, fetchCv, saveCvDetails, saveEducation, saveExperience, saveReferee,
  toCvData, type CvRecord, type CvTable,
} from '../../lib/cv';
import { exportCv, type CvFormat } from '../../lib/cv-export';
import { CvPreview } from '../../components/cv-preview';

const EMPTY: CvRecord = { details: null, education: [], experience: [], referees: [] };

const input = 'rounded-md border border-border bg-card px-3 py-2.5 text-[14px] text-foreground';

function Field({
  label, value, onChangeText, placeholder, keyboardType, multiline, maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'email-address' | 'phone-pad';
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-[11.5px] font-medium text-mutedForeground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        keyboardType={keyboardType ?? 'default'}
        multiline={multiline ?? false}
        maxLength={maxLength}
        textAlignVertical={multiline === true ? 'top' : 'center'}
        className={`${input} ${multiline === true ? 'min-h-[76px]' : 'h-11'}`}
      />
    </View>
  );
}

/** A saved entry, with the one destructive action kept quiet and to the side. */
function EntryRow({
  title, subtitle, years, onDelete,
}: { title: string; subtitle: string; years: string; onDelete: () => void }) {
  return (
    <View className="flex-row items-start gap-2 border-b border-border py-2.5">
      <View className="min-w-0 flex-1">
        <Text className="text-[12.5px] font-medium text-foreground">{title}</Text>
        <Text className="text-[11.5px] text-mutedForeground">{subtitle}</Text>
      </View>
      {years === '' ? null : <Text className="text-[11px] text-mutedForeground">{years}</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${title}`} onPress={onDelete} hitSlop={8}>
        <Feather name="x" size={15} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

export default function CvScreen() {
  const teacher = useTeacher();
  const insets = useSafeAreaInsets();

  const [cv, setCv] = useState<CvRecord>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [template, setTemplate] = useState<CvTemplate>('classic');

  const preview = useMemo(() => toCvData(teacher, cv), [teacher, cv]);

  const [summary, setSummary] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');

  // Draft rows for the three "add" forms.
  const [edu, setEdu] = useState({ institution: '', qualification: '', start: '', end: '', grade: '' });
  const [exp, setExp] = useState({ organisation: '', role: '', start: '', end: '', current: false, description: '' });
  const [ref, setRef] = useState({ name: '', title: '', organisation: '', phone: '', email: '' });

  const load = useCallback(async () => {
    try {
      const record = await fetchCv();
      setCv(record);
      setSummary(record.details?.summary ?? '');
      setEmail(record.details?.email ?? '');
      setPhone(record.details?.phone ?? '');
      setLocation(record.details?.location ?? '');
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your CV');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (work: () => Promise<void>, failure: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : failure);
    } finally {
      setBusy(false);
    }
  };

  const year = (v: string): number | null => {
    const n = Number.parseInt(v, 10);
    return Number.isInteger(n) && n >= 1950 && n <= 2100 ? n : null;
  };
  const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

  const doExport = async (format: CvFormat) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const result = await exportCv(preview, template, format);
      setNote(result.kind === 'shared'
        ? `${result.fileName} is ready to send.`
        : `Saved as ${result.fileName}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not build your CV file');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ title: 'Your CV' }} />
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Your CV' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <NoticeStrip>
          <Text className="text-[11.5px] leading-4 text-mutedForeground">
            Your name, subjects and TSC number come from your profile, so your CV and the roles
            you match can never disagree. Edit them there.
          </Text>
        </NoticeStrip>

        {/* --------------------------------------------------------- contact */}
        <Card className="gap-2.5 px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">Contact & profile</Text>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+254 712 345678" />
          <Field label="Location" value={location} onChangeText={setLocation} placeholder="Nairobi" />
          <Field
            label="Personal statement"
            value={summary}
            onChangeText={setSummary}
            multiline
            maxLength={1200}
            placeholder="Two or three sentences: what you teach, how long, and what you are looking for."
          />
          <Button
            label="Save details"
            variant="secondary"
            onPress={() => void run(
              () => saveCvDetails(teacher.id, {
                summary: orNull(summary), email: orNull(email),
                phone: orNull(phone), location: orNull(location),
              }),
              'Could not save your details',
            )}
          />
        </Card>

        {/* ------------------------------------------------------ experience */}
        <Card className="gap-2 px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">Experience</Text>
          {orderExperience(cv.experience.map((e) => ({
            organisation: e.organisation, role: e.role, startYear: e.start_year,
            endYear: e.end_year, isCurrent: e.is_current, description: e.description,
          }))).map((e, i) => {
            const row = cv.experience.find((r) => r.role === e.role && r.organisation === e.organisation);
            return (
              <EntryRow
                key={row?.id ?? i}
                title={e.role}
                subtitle={e.organisation}
                years={formatYearRange(e.startYear, e.endYear, e.isCurrent)}
                onDelete={() => { if (row) void run(() => deleteCvEntry('cv_experience', row.id), 'Could not remove that'); }}
              />
            );
          })}

          <Field label="Role" value={exp.role} onChangeText={(v) => setExp({ ...exp, role: v })} placeholder="Mathematics Teacher" />
          <Field label="School or organisation" value={exp.organisation} onChangeText={(v) => setExp({ ...exp, organisation: v })} placeholder="Greenfield Academy" />
          <View className="flex-row gap-2">
            <View className="flex-1"><Field label="From" value={exp.start} onChangeText={(v) => setExp({ ...exp, start: v })} keyboardType="number-pad" placeholder="2019" /></View>
            {exp.current ? null : (
              <View className="flex-1"><Field label="To" value={exp.end} onChangeText={(v) => setExp({ ...exp, end: v })} keyboardType="number-pad" placeholder="2022" /></View>
            )}
          </View>
          <ToggleRow
            label="I still work here"
            value={exp.current}
            // Clearing the end year here, not just hiding the field: the
            // database refuses a current role that also has an end year.
            onValueChange={(v) => setExp({ ...exp, current: v, end: v ? '' : exp.end })}
          />
          <Field label="What you did (optional)" value={exp.description} onChangeText={(v) => setExp({ ...exp, description: v })} multiline maxLength={2000} />
          <Button
            label="Add role"
            variant="secondary"
            disabled={exp.role.trim() === '' || exp.organisation.trim() === ''}
            onPress={() => void run(async () => {
              await saveExperience({
                user_id: teacher.id,
                role: exp.role.trim(),
                organisation: exp.organisation.trim(),
                start_year: year(exp.start),
                end_year: exp.current ? null : year(exp.end),
                is_current: exp.current,
                description: orNull(exp.description),
              });
              setExp({ organisation: '', role: '', start: '', end: '', current: false, description: '' });
            }, 'Could not add that role')}
          />
        </Card>

        {/* ------------------------------------------------------- education */}
        <Card className="gap-2 px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">Education</Text>
          {orderEducation(cv.education.map((e) => ({
            institution: e.institution, qualification: e.qualification,
            startYear: e.start_year, endYear: e.end_year, grade: e.grade,
          }))).map((e, i) => {
            const row = cv.education.find((r) => r.qualification === e.qualification && r.institution === e.institution);
            return (
              <EntryRow
                key={row?.id ?? i}
                title={e.qualification}
                subtitle={e.institution}
                years={formatYearRange(e.startYear, e.endYear)}
                onDelete={() => { if (row) void run(() => deleteCvEntry('cv_education', row.id), 'Could not remove that'); }}
              />
            );
          })}

          <Field label="Qualification" value={edu.qualification} onChangeText={(v) => setEdu({ ...edu, qualification: v })} placeholder="B.Ed (Science)" />
          <Field label="Institution" value={edu.institution} onChangeText={(v) => setEdu({ ...edu, institution: v })} placeholder="University of Nairobi" />
          <View className="flex-row gap-2">
            <View className="flex-1"><Field label="From" value={edu.start} onChangeText={(v) => setEdu({ ...edu, start: v })} keyboardType="number-pad" placeholder="2012" /></View>
            <View className="flex-1"><Field label="To" value={edu.end} onChangeText={(v) => setEdu({ ...edu, end: v })} keyboardType="number-pad" placeholder="2016" /></View>
          </View>
          <Field label="Grade (optional)" value={edu.grade} onChangeText={(v) => setEdu({ ...edu, grade: v })} placeholder="Second Class Upper" />
          <Button
            label="Add qualification"
            variant="secondary"
            disabled={edu.qualification.trim() === '' || edu.institution.trim() === ''}
            onPress={() => void run(async () => {
              await saveEducation({
                user_id: teacher.id,
                qualification: edu.qualification.trim(),
                institution: edu.institution.trim(),
                start_year: year(edu.start),
                end_year: year(edu.end),
                grade: orNull(edu.grade),
              });
              setEdu({ institution: '', qualification: '', start: '', end: '', grade: '' });
            }, 'Could not add that qualification')}
          />
        </Card>

        {/* -------------------------------------------------------- referees */}
        <Card className="gap-2 px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">Referees</Text>
          <Text className="text-[11px] leading-4 text-mutedForeground">
            Only ever printed on the CV you export. Nobody can browse these.
          </Text>
          {cv.referees.map((r) => (
            <EntryRow
              key={r.id}
              title={r.name}
              subtitle={[r.title, r.organisation].filter((p) => p !== null && p !== '').join(' · ')}
              years=""
              onDelete={() => void run(() => deleteCvEntry('cv_referees', r.id), 'Could not remove that')}
            />
          ))}
          <Field label="Name" value={ref.name} onChangeText={(v) => setRef({ ...ref, name: v })} placeholder="Jane Muthoni" />
          <Field label="Title" value={ref.title} onChangeText={(v) => setRef({ ...ref, title: v })} placeholder="Head Teacher" />
          <Field label="Organisation" value={ref.organisation} onChangeText={(v) => setRef({ ...ref, organisation: v })} placeholder="Greenfield Academy" />
          <View className="flex-row gap-2">
            <View className="flex-1"><Field label="Phone" value={ref.phone} onChangeText={(v) => setRef({ ...ref, phone: v })} keyboardType="phone-pad" /></View>
            <View className="flex-1"><Field label="Email" value={ref.email} onChangeText={(v) => setRef({ ...ref, email: v })} keyboardType="email-address" /></View>
          </View>
          <Button
            label="Add referee"
            variant="secondary"
            disabled={ref.name.trim() === ''}
            onPress={() => void run(async () => {
              await saveReferee({
                user_id: teacher.id,
                name: ref.name.trim(),
                title: orNull(ref.title),
                organisation: orNull(ref.organisation),
                phone: orNull(ref.phone),
                email: orNull(ref.email),
              });
              setRef({ name: '', title: '', organisation: '', phone: '', email: '' });
            }, 'Could not add that referee')}
          />
        </Card>

        {/* -------------------------------------------------------- download */}
        <Card className="gap-2.5 px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">Preview & download</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {(Object.keys(CV_TEMPLATES) as CvTemplate[]).map((t) => (
              <Chip key={t} label={CV_TEMPLATES[t]} selected={template === t} onPress={() => setTemplate(t)} />
            ))}
          </View>
          <Text className="text-[11px] leading-4 text-mutedForeground">{CV_TEMPLATE_HINT[template]}</Text>

          {/*
            The real document, at the size it will print. Rebuilt only when the
            template or the saved record changes — the drafts above are local
            state, so typing does not re-render a whole page on every keystroke.
          */}
          <CvPreview cv={preview} template={template} />

          <View className="mt-1 flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void doExport('pdf')}
              style={{ borderRadius: radius.md, borderCurve: 'continuous' }}
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 bg-primary"
            >
              <Feather name="download" size={14} color={colors.primaryForeground} />
              <Text className="text-[13px] font-medium text-primaryForeground">PDF</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void doExport('word')}
              style={{ borderRadius: radius.md, borderCurve: 'continuous' }}
              className="h-11 flex-1 flex-row items-center justify-center gap-1.5 border border-border bg-card"
            >
              <Feather name="download" size={14} color={colors.foreground} />
              <Text className="text-[13px] font-medium text-foreground">Word</Text>
            </Pressable>
          </View>
          {note === null ? null : <Text className="text-[11.5px] text-successForeground">{note}</Text>}
        </Card>

        {error !== null ? <ErrorBanner message={error} /> : null}
        {busy ? <ActivityIndicator color={colors.mutedForeground} className="py-2" /> : null}
      </ScrollView>
    </View>
  );
}
