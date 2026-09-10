import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {
  CV_TEMPLATES, CV_TEMPLATE_HINT, CV_VISIBILITY_HINT, CV_VISIBILITY_LABEL,
  certificateWhen, formatYearRange, orderEducation, orderExperience,
  type CvTemplate,
} from '@mwalimu/core';
import { CvVisibility } from '@mwalimu/types';
import { colors, radius } from '@mwalimu/ui';
import {
  Button, Card, centredContent, Chip, ErrorBanner, NoticeStrip, ToggleRow, WhyDisabled,
} from '../../components/ui';
import { ListEditor } from '../../components/list-editor';
import { useAuth, useTeacher } from '../../lib/auth';
import {
  deleteCvEntry, EMPTY_CV, fetchCv, fetchPhotoDataUri, removePhoto, saveCertificate,
  saveCvDetails, saveCvPhotoPath, saveEducation, saveExperience, saveReferee, saveSkills,
  toCvData, uploadPhoto, type CvRecord, type CvTable,
} from '../../lib/cv';
import { pickPhoto } from '../../lib/pick-photo';
import { exportCv, type CvFormat } from '../../lib/cv-export';
import { CvPreview } from '../../components/cv-preview';

const input = 'rounded-md border border-border bg-card px-3 py-2.5 text-[14px] text-foreground';

function Field({
  label, value, onChangeText, placeholder, keyboardType, multiline, maxLength, hint,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'number-pad' | 'email-address' | 'phone-pad';
  multiline?: boolean;
  maxLength?: number;
  hint?: string;
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
      {hint === undefined ? null : (
        <Text className="text-[10.5px] leading-4 text-mutedForeground">{hint}</Text>
      )}
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
        {subtitle === '' ? null : (
          <Text className="text-[11.5px] text-mutedForeground">{subtitle}</Text>
        )}
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
  const { refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [cv, setCv] = useState<CvRecord>(EMPTY_CV);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [template, setTemplate] = useState<CvTemplate>('portrait');

  const preview = useMemo(() => toCvData(teacher, cv, photo), [teacher, cv, photo]);

  // Personal details.
  const [summary, setSummary] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [postCode, setPostCode] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [nationality, setNationality] = useState('');
  const [visibility, setVisibility] = useState<CvVisibility>('applied');

  // The lists.
  const [skills, setSkills] = useState<readonly string[]>([]);
  const [languages, setLanguages] = useState<readonly string[]>([]);
  const [hobbies, setHobbies] = useState<readonly string[]>([]);
  const [responsibilities, setResponsibilities] = useState<readonly string[]>([]);

  // Draft rows for the "add" forms.
  const [edu, setEdu] = useState({ institution: '', qualification: '', start: '', end: '', grade: '' });
  const [exp, setExp] = useState({ organisation: '', role: '', start: '', end: '', current: false, description: '' });
  const [vol, setVol] = useState({ organisation: '', role: '', start: '', end: '', current: false, description: '' });
  const [ref, setRef] = useState({ name: '', title: '', organisation: '', phone: '', email: '' });
  const [cert, setCert] = useState({ title: '', description: '', year: '', ongoing: false });

  // What each Add button is still waiting for. Every field here shows a
  // placeholder, which reads as filled in, so a greyed button with no reason
  // looks broken rather than unfinished.
  const expMissing = [
    ...(exp.role.trim() === '' ? ['a role'] : []),
    ...(exp.organisation.trim() === '' ? ['a school or organisation'] : []),
  ];
  const volMissing = vol.role.trim() === '' ? ['what you did'] : [];
  const eduMissing = [
    ...(edu.qualification.trim() === '' ? ['a qualification'] : []),
    ...(edu.institution.trim() === '' ? ['an institution'] : []),
  ];
  const refMissing = ref.name.trim() === '' ? ['a name'] : [];
  const certMissing = cert.title.trim().length < 2 ? ['a name for the certificate'] : [];

  const load = useCallback(async () => {
    try {
      const record = await fetchCv();
      setCv(record);
      setSummary(record.details?.summary ?? '');
      setEmail(record.details?.email ?? '');
      setPhone(record.details?.phone ?? '');
      setLocation(record.details?.location ?? '');
      setAddress(record.details?.address ?? '');
      setPostCode(record.details?.post_code ?? '');
      setDob(record.details?.date_of_birth ?? '');
      setGender(record.details?.gender ?? '');
      setNationality(record.details?.nationality ?? '');
      setVisibility(record.details?.visibility ?? 'applied');
      setLanguages(record.details?.languages ?? []);
      setHobbies(record.details?.hobbies ?? []);
      setResponsibilities(record.details?.responsibilities ?? []);
      setPhoto(await fetchPhotoDataUri(record.details?.photo_path ?? null));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your CV');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  /*
    Skills come from the profile, so they are seeded from the profile and not
    from `load`. Doing it in `load` meant the handler that saved them then
    re-read a `teacher.skills` captured before `refreshProfile` had returned,
    and the list a teacher had just typed disappeared from the form until they
    reloaded the screen — saved in the database, gone from the page, which
    reads as having lost the work.
  */
  useEffect(() => { setSkills(teacher.skills); }, [teacher.skills]);

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

  /**
   * The date the database wants, or nothing.
   *
   * A teacher types "23/12/1996" or "1996-12-23" depending on where they last
   * filled a form. Both are accepted; anything else saves as no date rather
   * than as a constraint violation they cannot read.
   */
  const isoDate = (v: string): string | null => {
    const text = v.trim();
    if (text === '') return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (iso !== null) return text;
    const slashed = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(text);
    if (slashed === null) return null;
    const [, d, m, y] = slashed;
    return `${y}-${(m ?? '').padStart(2, '0')}-${(d ?? '').padStart(2, '0')}`;
  };
  const dobUnreadable = dob.trim() !== '' && isoDate(dob) === null;

  const choosePhoto = () => void run(async () => {
    const picked = await pickPhoto();
    if (picked === null) return;
    const path = await uploadPhoto(teacher.id, picked.blob, picked.extension);
    await saveCvPhotoPath(teacher.id, path);
  }, 'Could not save that photograph');

  const clearPhoto = () => void run(async () => {
    const path = cv.details?.photo_path;
    if (path != null && path !== '') await removePhoto(path);
    await saveCvPhotoPath(teacher.id, null);
  }, 'Could not remove that photograph');

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

  const draftRole = (
    draft: typeof exp,
    set: (v: typeof exp) => void,
    words: { role: string; where: string; rolePlaceholder: string; wherePlaceholder: string },
  ) => (
    <>
      <Field label={words.role} value={draft.role} onChangeText={(v) => set({ ...draft, role: v })} placeholder={words.rolePlaceholder} />
      <Field label={words.where} value={draft.organisation} onChangeText={(v) => set({ ...draft, organisation: v })} placeholder={words.wherePlaceholder} />
      <View className="flex-row gap-2">
        <View className="flex-1"><Field label="From" value={draft.start} onChangeText={(v) => set({ ...draft, start: v })} keyboardType="number-pad" placeholder="2019" /></View>
        {draft.current ? null : (
          <View className="flex-1"><Field label="To" value={draft.end} onChangeText={(v) => set({ ...draft, end: v })} keyboardType="number-pad" placeholder="2022" /></View>
        )}
      </View>
      <ToggleRow
        label="I am still doing this"
        value={draft.current}
        // Clearing the end year here, not just hiding the field: the
        // database refuses a current role that also has an end year.
        onValueChange={(v) => set({ ...draft, current: v, end: v ? '' : draft.end })}
      />
      <Field
        label="What you did (optional)"
        value={draft.description}
        onChangeText={(v) => set({ ...draft, description: v })}
        multiline
        maxLength={2000}
        hint="Start a line with a dash for a bullet. A plain line above a run of bullets becomes its heading — that is how “Key Responsibilities” prints as one."
      />
    </>
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Your CV' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40, ...centredContent }}
        keyboardShouldPersistTaps="handled"
      >
        <NoticeStrip>
          <Text className="text-[11.5px] leading-4 text-mutedForeground">
            Your name, subjects and TSC number come from your profile, so your CV and the roles
            you match can never disagree. Edit them there.
          </Text>
        </NoticeStrip>

        {/* ------------------------------------------------------ visibility */}
        <Card className="gap-2.5 px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">Who can read it</Text>
          <View className="flex-row flex-wrap gap-1.5">
            {CvVisibility.options.map((v) => (
              <Chip
                key={v}
                label={CV_VISIBILITY_LABEL[v]}
                selected={visibility === v}
                onPress={() => {
                  setVisibility(v);
                  void run(() => saveCvDetails(teacher.id, { visibility: v }), 'Could not save that');
                }}
              />
            ))}
          </View>
          <Text className="text-[11px] leading-4 text-mutedForeground">
            {CV_VISIBILITY_HINT[visibility]}
          </Text>
        </Card>

        {/* -------------------------------------------------------- the photo */}
        <Card className="gap-2.5 px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">Photograph</Text>
          <View className="flex-row items-center gap-3">
            {photo === null ? (
              <View className="h-[76px] w-[60px] items-center justify-center rounded-md border border-dashed border-border bg-wash">
                <Feather name="user" size={20} color={colors.mutedForeground} />
              </View>
            ) : (
              <Image
                source={{ uri: photo }}
                style={{ width: 60, height: 76, borderRadius: radius.sm }}
                accessibilityLabel="Your CV photograph"
              />
            )}
            <View className="min-w-0 flex-1 gap-1.5">
              <Button
                label={photo === null ? 'Choose a photograph' : 'Replace'}
                variant="secondary"
                onPress={choosePhoto}
              />
              {photo === null ? null : (
                <Pressable accessibilityRole="button" onPress={clearPhoto} className="py-1">
                  <Text className="text-[11.5px] font-medium text-mutedForeground">Remove</Text>
                </Pressable>
              )}
            </View>
          </View>
          <Text className="text-[10.5px] leading-4 text-mutedForeground">
            Only ever on the CV. Nobody who cannot read your CV can see it, and it travels inside
            the file you download rather than as a link that expires.
          </Text>
        </Card>

        {/* ------------------------------------------------- personal details */}
        <Card className="gap-2.5 px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">Personal details</Text>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+254 712 345678" />
          <Field label="Address" value={address} onChangeText={setAddress} placeholder="P.O. Box 132-50311" maxLength={200} />
          <View className="flex-row gap-2">
            <View className="flex-1"><Field label="Post code" value={postCode} onChangeText={setPostCode} placeholder="50311" maxLength={20} /></View>
            <View className="flex-[2]"><Field label="City or town" value={location} onChangeText={setLocation} placeholder="Nairobi" /></View>
          </View>
          <Field
            label="Date of birth"
            value={dob}
            onChangeText={setDob}
            placeholder="23/12/1996"
            hint={dobUnreadable ? 'Write it as 23/12/1996 or 1996-12-23.' : undefined}
          />
          <View className="flex-row gap-2">
            <View className="flex-1"><Field label="Gender" value={gender} onChangeText={setGender} placeholder="Female" maxLength={40} /></View>
            <View className="flex-1"><Field label="Nationality" value={nationality} onChangeText={setNationality} placeholder="Kenyan" maxLength={60} /></View>
          </View>
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
            disabled={dobUnreadable}
            onPress={() => void run(
              () => saveCvDetails(teacher.id, {
                summary: orNull(summary), email: orNull(email),
                phone: orNull(phone), location: orNull(location),
                address: orNull(address), post_code: orNull(postCode),
                date_of_birth: isoDate(dob), gender: orNull(gender),
                nationality: orNull(nationality),
              }),
              'Could not save your details',
            )}
          />
          <WhyDisabled missing={dobUnreadable ? ['a date it can read'] : []} />
        </Card>

        {/* ------------------------------------------------------ experience */}
        <Card className="gap-2 px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">Experience</Text>
          {cv.experience.filter((e) => !e.is_volunteer).map((row) => (
            <EntryRow
              key={row.id}
              title={row.role}
              subtitle={row.organisation}
              years={formatYearRange(row.start_year, row.end_year, row.is_current)}
              onDelete={() => void run(() => deleteCvEntry('cv_experience', row.id), 'Could not remove that')}
            />
          ))}
          {draftRole(exp, setExp, {
            role: 'Role', where: 'School or organisation',
            rolePlaceholder: 'Mathematics Teacher', wherePlaceholder: 'Greenfield Academy',
          })}
          <Button
            label="Add role"
            variant="secondary"
            disabled={expMissing.length > 0}
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
          <WhyDisabled missing={expMissing} />
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
            disabled={eduMissing.length > 0}
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
          <WhyDisabled missing={eduMissing} />
        </Card>

        {/* ---------------------------------------------------------- lists */}
        <Card className="gap-3.5 px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">Skills and languages</Text>
          <ListEditor label="Skills" items={skills} onChange={setSkills} placeholder="Computer packages" />
          <ListEditor label="Languages" items={languages} onChange={setLanguages} placeholder="Kiswahili" />
          <ListEditor label="Hobbies" items={hobbies} onChange={setHobbies} placeholder="Reading novels" />
          <ListEditor
            label="Positions of responsibility"
            items={responsibilities}
            onChange={setResponsibilities}
            placeholder="Class teacher, Form 4G"
          />
          <Button
            label="Save lists"
            variant="secondary"
            onPress={() => void run(async () => {
              await saveCvDetails(teacher.id, {
                languages: [...languages], hobbies: [...hobbies],
                responsibilities: [...responsibilities],
              });
              // Skills live on the profile, so the session's copy has to be
              // told — otherwise the preview below keeps rendering the old set.
              await saveSkills(teacher.id, skills);
              await refreshProfile();
            }, 'Could not save those')}
          />
        </Card>

        {/* ----------------------------------------------------- volunteering */}
        <Card className="gap-2 px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">Volunteer work</Text>
          {cv.experience.filter((e) => e.is_volunteer).map((row) => (
            <EntryRow
              key={row.id}
              title={row.role}
              subtitle={row.organisation}
              years={formatYearRange(row.start_year, row.end_year, row.is_current)}
              onDelete={() => void run(() => deleteCvEntry('cv_experience', row.id), 'Could not remove that')}
            />
          ))}
          {draftRole(vol, setVol, {
            role: 'What you did', where: 'Where (optional)',
            rolePlaceholder: 'Receptionist', wherePlaceholder: 'Makori Nyangau & Co Advocates',
          })}
          <Button
            label="Add volunteer work"
            variant="secondary"
            disabled={volMissing.length > 0}
            onPress={() => void run(async () => {
              await saveExperience({
                user_id: teacher.id,
                role: vol.role.trim(),
                organisation: vol.organisation.trim(),
                start_year: year(vol.start),
                end_year: vol.current ? null : year(vol.end),
                is_current: vol.current,
                description: orNull(vol.description),
                is_volunteer: true,
              });
              setVol({ organisation: '', role: '', start: '', end: '', current: false, description: '' });
            }, 'Could not add that')}
          />
          <WhyDisabled missing={volMissing} />
        </Card>

        {/* ----------------------------------------------------- certificates */}
        <Card className="gap-2 px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">Certificates</Text>
          {cv.certificates.map((row) => (
            <EntryRow
              key={row.id}
              title={row.title}
              subtitle={row.description ?? ''}
              years={certificateWhen({
                title: row.title, description: row.description,
                year: row.year, isOngoing: row.is_ongoing,
              })}
              onDelete={() => void run(() => deleteCvEntry('cv_certificates', row.id), 'Could not remove that')}
            />
          ))}
          <Field label="Certificate" value={cert.title} onChangeText={(v) => setCert({ ...cert, title: v })} placeholder="Certificate in computer packages" maxLength={160} />
          <Field label="Where (optional)" value={cert.description} onChangeText={(v) => setCert({ ...cert, description: v })} placeholder="Probation Community Resource & Training Centre, Webuye" maxLength={400} multiline />
          {cert.ongoing ? null : (
            <Field label="Year (optional)" value={cert.year} onChangeText={(v) => setCert({ ...cert, year: v })} keyboardType="number-pad" placeholder="2016" />
          )}
          <ToggleRow
            label="Still studying for it"
            value={cert.ongoing}
            // The database refuses a year on something still in progress, and
            // a CV claiming both is one a reader stops trusting.
            onValueChange={(v) => setCert({ ...cert, ongoing: v, year: v ? '' : cert.year })}
          />
          <Button
            label="Add certificate"
            variant="secondary"
            disabled={certMissing.length > 0}
            onPress={() => void run(async () => {
              await saveCertificate({
                user_id: teacher.id,
                title: cert.title.trim(),
                description: orNull(cert.description),
                year: cert.ongoing ? null : year(cert.year),
                is_ongoing: cert.ongoing,
              });
              setCert({ title: '', description: '', year: '', ongoing: false });
            }, 'Could not add that certificate')}
          />
          <WhyDisabled missing={certMissing} />
        </Card>

        {/* -------------------------------------------------------- referees */}
        <Card className="gap-2 px-3.5 py-3">
          <Text className="text-[12.5px] font-medium text-foreground">Referees</Text>
          <Text className="text-[11px] leading-4 text-mutedForeground">
            Only the people you actually apply to ever see these, whatever the setting above says.
            A referee agreed to vouch for you, not to be in a directory.
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
            disabled={refMissing.length > 0}
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
          <WhyDisabled missing={refMissing} />
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
