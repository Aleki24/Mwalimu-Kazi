import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Image, type LayoutChangeEvent, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {
  CV_VISIBILITY_HINT, CV_VISIBILITY_LABEL, certificateWhen, cvReadiness, formatYearRange,
  orderEducation, orderExperience, type CvStep, type CvStepId,
} from '@mwalimu/core';
import { CvVisibility } from '@mwalimu/types';
import { colors, radius } from '@mwalimu/ui';
import {
  Button, Card, centredContent, Chip, ErrorBanner, ToggleRow, WhyDisabled,
} from '../../components/ui';
import { ListEditor } from '../../components/list-editor';
import { LanguageEditor } from '../../components/language-editor';
import { CollapsibleSection } from '../../components/collapsible-section';
import { CvReadinessCard } from '../../components/cv-checklist';
import { useAuth, useTeacher } from '../../lib/auth';
import {
  cvFactsFrom, deleteCvEntry, EMPTY_CV, fetchCv, fetchPhotoDataUri, removePhoto, saveCertificate,
  saveCvDetails, saveCvPhotoPath, saveEducation, saveExperience, saveLanguage, saveReferee,
  saveSkills, uploadPhoto, type CertificateRow, type CvRecord, type EducationRow,
  type ExperienceRow, type RefereeRow,
} from '../../lib/cv';
import { pickPhoto } from '../../lib/pick-photo';

/**
 * The CV editor.
 *
 * It is one long form, and the thing that makes a long form bearable is
 * knowing why you are filling it in. The checklist at the top says how far
 * along the document is, what a school reads first, and what to do next; every
 * item on it opens the section that answers it. Below that the folds are in
 * the order a CV is written rather than the order the tables were built in,
 * and the ones that decide how the page *looks* have moved to the preview,
 * where you can see what they do.
 *
 * One fold is open at a time. Nine open folds is the wall of inputs this
 * screen used to be, and the drafts live here rather than inside the folds, so
 * closing one to look at another never loses what was typed into it.
 */

const input = 'rounded-md border border-border bg-card px-3 py-2.5 text-[14px] text-foreground';

/** Everything that can be open, including the one fold that is not a CV step. */
type SectionId = CvStepId | 'privacy';

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

/**
 * A saved entry: tap it to correct it, and the one destructive action asks.
 *
 * Everything on a CV is typed on a phone, and until now the only way to fix a
 * misspelt school was to delete the entry and write it again from memory. The
 * row is now the way back into the form that made it.
 *
 * Removing asks in place rather than through an alert. `Alert` is a no-op in
 * the web build, so a confirmation there would either be skipped entirely or
 * have to exist twice; two taps on the row itself behave the same everywhere.
 */
function EntryRow({
  title, subtitle, years, editing, onEdit, onDelete,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly years: string;
  readonly editing: boolean;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <View className="flex-row items-center gap-2 border-b border-border py-2">
        <Text numberOfLines={1} className="min-w-0 flex-1 text-[11.5px] text-mutedForeground">
          {`Remove ${title}?`}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Keep ${title}`}
          onPress={() => setConfirming(false)}
          className="min-h-[44px] justify-center px-2"
        >
          <Text className="text-[12px] font-medium text-mutedForeground">Keep</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${title}`}
          onPress={() => { setConfirming(false); onDelete(); }}
          className="min-h-[44px] justify-center px-2"
        >
          <Text className="text-[12px] font-medium text-destructiveForeground">Remove</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-2 border-b border-border">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${title}`}
        onPress={onEdit}
        className="min-h-[44px] min-w-0 flex-1 flex-row items-center gap-2 py-2"
      >
        <View className="min-w-0 flex-1">
          <Text className="text-[12.5px] font-medium text-foreground">{title}</Text>
          {subtitle === '' ? null : (
            <Text className="text-[11.5px] text-mutedForeground">{subtitle}</Text>
          )}
        </View>
        {editing ? (
          <Text className="text-[10.5px] font-medium text-primary">Editing</Text>
        ) : years === '' ? null : (
          <Text className="text-[11px] text-mutedForeground">{years}</Text>
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Remove ${title}`}
        onPress={() => setConfirming(true)}
        hitSlop={8}
        className="min-h-[44px] w-8 items-center justify-center"
      >
        <Feather name="x" size={15} color={colors.mutedForeground} />
      </Pressable>
    </View>
  );
}

/**
 * One fold of the form, wearing the state of the step it collects.
 *
 * Defined outside the screen so that opening a section does not remount the
 * inputs inside it — a component declared in a render body is a new component
 * on every keystroke, and every field in it loses focus.
 */
function StepSection({
  step, summary, open, onOpenChange, onLayout, children,
}: {
  readonly step: CvStep;
  readonly summary: string;
  readonly open: boolean;
  readonly onOpenChange: (next: boolean) => void;
  readonly onLayout: (event: LayoutChangeEvent) => void;
  readonly children: ReactNode;
}) {
  return (
    <View onLayout={onLayout}>
      <CollapsibleSection
        title={step.label}
        summary={summary}
        why={step.why}
        status={{ done: step.done, essential: step.essential }}
        open={open}
        onOpenChange={onOpenChange}
      >
        {children}
      </CollapsibleSection>
    </View>
  );
}

/** A role or a stint of volunteering, mid-edit. `id` is null while it is new. */
interface RoleDraft {
  readonly id: string | null;
  readonly role: string;
  readonly organisation: string;
  readonly start: string;
  readonly end: string;
  readonly current: boolean;
  readonly description: string;
}

interface EducationDraft {
  readonly id: string | null;
  readonly institution: string;
  readonly qualification: string;
  readonly start: string;
  readonly end: string;
  readonly grade: string;
}

interface RefereeDraft {
  readonly id: string | null;
  readonly name: string;
  readonly title: string;
  readonly organisation: string;
  readonly phone: string;
  readonly email: string;
}

interface CertificateDraft {
  readonly id: string | null;
  readonly title: string;
  readonly description: string;
  readonly year: string;
  readonly ongoing: boolean;
}

const EMPTY_ROLE: RoleDraft = {
  id: null, role: '', organisation: '', start: '', end: '', current: false, description: '',
};
const EMPTY_EDUCATION: EducationDraft = {
  id: null, institution: '', qualification: '', start: '', end: '', grade: '',
};
const EMPTY_REFEREE: RefereeDraft = {
  id: null, name: '', title: '', organisation: '', phone: '', email: '',
};
const EMPTY_CERTIFICATE: CertificateDraft = {
  id: null, title: '', description: '', year: '', ongoing: false,
};

/** A year as the database wants it, or nothing. */
const asYear = (v: string): number | null => {
  const n = Number.parseInt(v, 10);
  return Number.isInteger(n) && n >= 1950 && n <= 2100 ? n : null;
};
const asText = (v: number | null): string => (v === null ? '' : String(v));
const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

/**
 * Carry the id back on an edit, and leave it off on an insert.
 *
 * Supabase upserts on the primary key, so this one line is the whole
 * difference between correcting a row and adding a second one beside it.
 */
function withId<T extends object>(row: T, id: string | null): T {
  return id === null ? row : { ...row, id };
}

export default function CvScreen() {
  const teacher = useTeacher();
  const { refreshProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [cv, setCv] = useState<CvRecord>(EMPTY_CV);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Which fold is open. One at a time: the checklist points at a section, and
  // pointing at something only works if the rest are out of the way.
  const [openSection, setOpenSection] = useState<SectionId | null>(null);
  const scroller = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<SectionId, number>>>({});
  // The section waiting to be scrolled to once it has finished opening. A ref
  // rather than state: nothing renders differently because of it.
  const pendingScroll = useRef<SectionId | null>(null);

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
  const [hobbies, setHobbies] = useState<readonly string[]>([]);
  const [responsibilities, setResponsibilities] = useState<readonly string[]>([]);

  // Draft rows for the add-and-edit forms.
  const [exp, setExp] = useState<RoleDraft>(EMPTY_ROLE);
  const [vol, setVol] = useState<RoleDraft>(EMPTY_ROLE);
  const [edu, setEdu] = useState<EducationDraft>(EMPTY_EDUCATION);
  const [ref, setRef] = useState<RefereeDraft>(EMPTY_REFEREE);
  const [cert, setCert] = useState<CertificateDraft>(EMPTY_CERTIFICATE);

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

  /**
   * How complete the CV is, from what is on screen rather than from a second
   * read of the database — so a role added a second ago already counts.
   */
  const readiness = useMemo(
    () => cvReadiness(cvFactsFrom({ skills }, cv)),
    [skills, cv],
  );

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

  /**
   * Save without reloading.
   *
   * `run` re-reads the whole CV afterwards, which is right for adding a role
   * and wrong for adding a skill — the list on screen is already what was just
   * saved, and a reload per item makes the + button feel like it is thinking.
   */
  const persist = async (work: () => Promise<void>, failure: string) => {
    setError(null);
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : failure);
    }
  };

  /*
    Each list saves the moment it changes.

    They used to sit in local state behind a "Save lists" button, so pressing +
    added a row that vanished on the next screen — indistinguishable, to the
    person doing it, from a + that does not work. An add is already a
    deliberate act; it does not need confirming twice.
  */
  const editSkills = (next: readonly string[]) => {
    setSkills(next);
    void persist(async () => {
      await saveSkills(teacher.id, next);
      await refreshProfile();
    }, 'Could not save your skills');
  };

  const editList = (
    key: 'hobbies' | 'responsibilities',
    set: (v: readonly string[]) => void,
  ) => (next: readonly string[]) => {
    set(next);
    void persist(() => saveCvDetails(teacher.id, { [key]: [...next] }), 'Could not save that');
  };

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

  /**
   * Open a section and bring it into view.
   *
   * The scroll waits for the fold to finish opening: the section above it may
   * be closing at the same moment, and a position measured before that lands
   * a hundred points off. `onLayout` fires once the new geometry is settled,
   * which is where the scroll is actually issued.
   */
  const reveal = (id: SectionId) => {
    const alreadyOpen = openSection === id;
    setOpenSection(id);
    if (alreadyOpen) scrollTo(offsets.current[id]);
    else pendingScroll.current = id;
  };

  const scrollTo = (y: number | undefined) => {
    if (y === undefined) return;
    scroller.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
  };

  const layout = (id: SectionId) => (event: LayoutChangeEvent) => {
    const { y } = event.nativeEvent.layout;
    offsets.current[id] = y;
    if (pendingScroll.current !== id) return;
    pendingScroll.current = null;
    scrollTo(y);
  };

  /** Everything a fold needs to know about itself, in one place. */
  const foldProps = (id: CvStepId, summaryLine: string) => ({
    step: readiness.byId[id],
    summary: summaryLine,
    open: openSection === id,
    onOpenChange: (next: boolean) => setOpenSection(next ? id : null),
    onLayout: layout(id),
  });

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

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ title: 'Your CV' }} />
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      </View>
    );
  }

  /**
   * What a closed section says about itself. Never a bare "0".
   *
   * The plural is given rather than guessed: appending "s" turned "entry" into
   * "4 entrys" on the first screen anyone looked at.
   */
  const counted = (n: number, one: string, many: string): string =>
    (n === 0 ? 'Not filled in' : `${n} ${n === 1 ? one : many}`);
  const filled = (...values: readonly string[]): string => {
    const done = values.filter((v) => v.trim() !== '').length;
    return done === 0 ? 'Not filled in' : `${done} of ${values.length} filled in`;
  };

  /** Pull a saved role back into the form that wrote it. */
  const editRole = (row: ExperienceRow) => {
    const draft: RoleDraft = {
      id: row.id,
      role: row.role,
      organisation: row.organisation,
      start: asText(row.start_year),
      end: asText(row.end_year),
      current: row.is_current,
      description: row.description ?? '',
    };
    if (row.is_volunteer) setVol(draft); else setExp(draft);
  };

  const saveRole = (draft: RoleDraft, isVolunteer: boolean, reset: () => void) =>
    void run(async () => {
      await saveExperience(withId({
        user_id: teacher.id,
        role: draft.role.trim(),
        organisation: draft.organisation.trim(),
        start_year: asYear(draft.start),
        end_year: draft.current ? null : asYear(draft.end),
        is_current: draft.current,
        description: orNull(draft.description),
        is_volunteer: isVolunteer,
      }, draft.id));
      reset();
    }, draft.id === null ? 'Could not add that' : 'Could not save that change');

  const draftRole = (
    draft: RoleDraft,
    set: (v: RoleDraft) => void,
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

  /** The button under an add-or-edit form, and the way out of an edit. */
  const draftActions = (
    editing: boolean,
    addLabel: string,
    missing: readonly string[],
    onSave: () => void,
    onCancel: () => void,
  ) => (
    <>
      <Button
        label={editing ? 'Save changes' : addLabel}
        variant="secondary"
        disabled={missing.length > 0}
        onPress={onSave}
      />
      {editing ? (
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          className="min-h-[44px] items-center justify-center"
        >
          <Text className="text-[12px] font-medium text-mutedForeground">
            Stop editing and start a new entry
          </Text>
        </Pressable>
      ) : null}
      <WhyDisabled missing={missing} />
    </>
  );

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Your CV' }} />
      <ScrollView
        ref={scroller}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 40, ...centredContent }}
        keyboardShouldPersistTaps="handled"
      >
        {error !== null ? <ErrorBanner message={error} /> : null}

        <CvReadinessCard
          readiness={readiness}
          onOpenStep={reveal}
          onPreview={() => router.push('/profile/cv-preview')}
        />

        {/* --------------------------------------------------- contact details */}
        <StepSection {...foldProps('contact', filled(phone, email, address, location))}>
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+254 712 345678" />
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
          <Field label="Address" value={address} onChangeText={setAddress} placeholder="P.O. Box 132-50311" maxLength={200} />
          <View className="flex-row gap-2">
            <View className="flex-1"><Field label="Post code" value={postCode} onChangeText={setPostCode} placeholder="50311" maxLength={20} /></View>
            <View className="flex-[2]"><Field label="City or town" value={location} onChangeText={setLocation} placeholder="Nairobi" /></View>
          </View>
          <Button
            label="Save contact details"
            variant="secondary"
            onPress={() => void run(
              () => saveCvDetails(teacher.id, {
                email: orNull(email), phone: orNull(phone), location: orNull(location),
                address: orNull(address), post_code: orNull(postCode),
              }),
              'Could not save your contact details',
            )}
          />
        </StepSection>

        {/* ------------------------------------------------ personal statement */}
        <StepSection {...foldProps('statement', summary.trim() === '' ? 'Not written yet' : 'Written')}>
          <Field
            label="Personal statement"
            value={summary}
            onChangeText={setSummary}
            multiline
            maxLength={1200}
            placeholder="Two or three sentences: what you teach, how long, and what you are looking for."
          />
          <Text className="text-[11px] font-medium text-mutedForeground">
            The rest is optional, and some Kenyan employers still ask for it.
          </Text>
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
          <Button
            label="Save"
            variant="secondary"
            disabled={dobUnreadable}
            onPress={() => void run(
              () => saveCvDetails(teacher.id, {
                summary: orNull(summary), date_of_birth: isoDate(dob),
                gender: orNull(gender), nationality: orNull(nationality),
              }),
              'Could not save that',
            )}
          />
          <WhyDisabled missing={dobUnreadable ? ['a date it can read'] : []} />
        </StepSection>

        {/* ------------------------------------------------------- experience */}
        <StepSection {...foldProps('experience', counted(readiness.byId.experience.count, 'role', 'roles'))}>
          {orderExperience(cv.experience.filter((e) => !e.is_volunteer).map(asOrderable)).map(({ row }) => (
            <EntryRow
              key={row.id}
              title={row.role}
              subtitle={row.organisation}
              years={formatYearRange(row.start_year, row.end_year, row.is_current)}
              editing={exp.id === row.id}
              onEdit={() => editRole(row)}
              onDelete={() => void run(async () => {
                await deleteCvEntry('cv_experience', row.id);
                if (exp.id === row.id) setExp(EMPTY_ROLE);
              }, 'Could not remove that')}
            />
          ))}
          {draftRole(exp, setExp, {
            role: 'Role', where: 'School or organisation',
            rolePlaceholder: 'Mathematics Teacher', wherePlaceholder: 'Greenfield Academy',
          })}
          {draftActions(
            exp.id !== null,
            'Add role',
            expMissing,
            () => saveRole(exp, false, () => setExp(EMPTY_ROLE)),
            () => setExp(EMPTY_ROLE),
          )}
        </StepSection>

        {/* -------------------------------------------------------- education */}
        <StepSection {...foldProps('education', counted(readiness.byId.education.count, 'qualification', 'qualifications'))}>
          {orderEducation(cv.education.map(asOrderableEducation)).map(({ row }) => (
            <EntryRow
              key={row.id}
              title={row.qualification}
              subtitle={row.institution}
              years={formatYearRange(row.start_year, row.end_year)}
              editing={edu.id === row.id}
              onEdit={() => setEdu({
                id: row.id,
                qualification: row.qualification,
                institution: row.institution,
                start: asText(row.start_year),
                end: asText(row.end_year),
                grade: row.grade ?? '',
              })}
              onDelete={() => void run(async () => {
                await deleteCvEntry('cv_education', row.id);
                if (edu.id === row.id) setEdu(EMPTY_EDUCATION);
              }, 'Could not remove that')}
            />
          ))}

          <Field label="Qualification" value={edu.qualification} onChangeText={(v) => setEdu({ ...edu, qualification: v })} placeholder="B.Ed (Science)" />
          <Field label="Institution" value={edu.institution} onChangeText={(v) => setEdu({ ...edu, institution: v })} placeholder="University of Nairobi" />
          <View className="flex-row gap-2">
            <View className="flex-1"><Field label="From" value={edu.start} onChangeText={(v) => setEdu({ ...edu, start: v })} keyboardType="number-pad" placeholder="2012" /></View>
            <View className="flex-1"><Field label="To" value={edu.end} onChangeText={(v) => setEdu({ ...edu, end: v })} keyboardType="number-pad" placeholder="2016" /></View>
          </View>
          <Field label="Grade (optional)" value={edu.grade} onChangeText={(v) => setEdu({ ...edu, grade: v })} placeholder="Second Class Upper" />
          {draftActions(
            edu.id !== null,
            'Add qualification',
            eduMissing,
            () => void run(async () => {
              await saveEducation(withId({
                user_id: teacher.id,
                qualification: edu.qualification.trim(),
                institution: edu.institution.trim(),
                start_year: asYear(edu.start),
                end_year: asYear(edu.end),
                grade: orNull(edu.grade),
              }, edu.id));
              setEdu(EMPTY_EDUCATION);
            }, 'Could not save that qualification'),
            () => setEdu(EMPTY_EDUCATION),
          )}
        </StepSection>

        {/* ----------------------------------------------------- certificates */}
        <StepSection {...foldProps('certificates', counted(readiness.byId.certificates.count, 'certificate', 'certificates'))}>
          {cv.certificates.map((row: CertificateRow) => (
            <EntryRow
              key={row.id}
              title={row.title}
              subtitle={row.description ?? ''}
              years={certificateWhen({
                title: row.title, description: row.description,
                year: row.year, isOngoing: row.is_ongoing,
              })}
              editing={cert.id === row.id}
              onEdit={() => setCert({
                id: row.id,
                title: row.title,
                description: row.description ?? '',
                year: asText(row.year),
                ongoing: row.is_ongoing,
              })}
              onDelete={() => void run(async () => {
                await deleteCvEntry('cv_certificates', row.id);
                if (cert.id === row.id) setCert(EMPTY_CERTIFICATE);
              }, 'Could not remove that')}
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
          {draftActions(
            cert.id !== null,
            'Add certificate',
            certMissing,
            () => void run(async () => {
              await saveCertificate(withId({
                user_id: teacher.id,
                title: cert.title.trim(),
                description: orNull(cert.description),
                year: cert.ongoing ? null : asYear(cert.year),
                is_ongoing: cert.ongoing,
              }, cert.id));
              setCert(EMPTY_CERTIFICATE);
            }, 'Could not save that certificate'),
            () => setCert(EMPTY_CERTIFICATE),
          )}
        </StepSection>

        {/* ------------------------------------------------ skills, languages */}
        <StepSection {...foldProps('skills', counted(readiness.byId.skills.count + hobbies.length + responsibilities.length, 'entry', 'entries'))}>
          <ListEditor label="Skills" items={skills} onChange={editSkills} placeholder="Computer packages" />
          <LanguageEditor
            items={cv.languages}
            onAdd={(name) => void run(
              () => saveLanguage({ user_id: teacher.id, name }), 'Could not add that language')}
            onLevel={(row, level) => void run(
              () => saveLanguage({ ...row, level }), 'Could not save that')}
            onRemove={(row) => void run(
              () => deleteCvEntry('cv_languages', row.id), 'Could not remove that')}
          />
          <ListEditor
            label="Hobbies"
            items={hobbies}
            onChange={editList('hobbies', setHobbies)}
            placeholder="Reading novels"
          />
          <ListEditor
            label="Positions of responsibility"
            items={responsibilities}
            onChange={editList('responsibilities', setResponsibilities)}
            placeholder="Class teacher, Form 4G"
          />
          <Text className="text-[10.5px] leading-4 text-mutedForeground">
            These save as you add them.
          </Text>
        </StepSection>

        {/* ----------------------------------------------------- volunteering */}
        <StepSection {...foldProps('volunteer', counted(readiness.byId.volunteer.count, 'entry', 'entries'))}>
          {orderExperience(cv.experience.filter((e) => e.is_volunteer).map(asOrderable)).map(({ row }) => (
            <EntryRow
              key={row.id}
              title={row.role}
              subtitle={row.organisation}
              years={formatYearRange(row.start_year, row.end_year, row.is_current)}
              editing={vol.id === row.id}
              onEdit={() => editRole(row)}
              onDelete={() => void run(async () => {
                await deleteCvEntry('cv_experience', row.id);
                if (vol.id === row.id) setVol(EMPTY_ROLE);
              }, 'Could not remove that')}
            />
          ))}
          {draftRole(vol, setVol, {
            role: 'What you did', where: 'Where (optional)',
            rolePlaceholder: 'Receptionist', wherePlaceholder: 'Makori Nyangau & Co Advocates',
          })}
          {draftActions(
            vol.id !== null,
            'Add volunteer work',
            volMissing,
            () => saveRole(vol, true, () => setVol(EMPTY_ROLE)),
            () => setVol(EMPTY_ROLE),
          )}
        </StepSection>

        {/* --------------------------------------------------------- referees */}
        <StepSection {...foldProps('referees', counted(readiness.byId.referees.count, 'referee', 'referees'))}>
          <Text className="text-[11px] leading-4 text-mutedForeground">
            Only the people you actually apply to ever see these, whatever the setting below says.
            A referee agreed to vouch for you, not to be in a directory.
          </Text>
          {cv.referees.map((row: RefereeRow) => (
            <EntryRow
              key={row.id}
              title={row.name}
              subtitle={[row.title, row.organisation].filter((p) => p !== null && p !== '').join(' · ')}
              years=""
              editing={ref.id === row.id}
              onEdit={() => setRef({
                id: row.id,
                name: row.name,
                title: row.title ?? '',
                organisation: row.organisation ?? '',
                phone: row.phone ?? '',
                email: row.email ?? '',
              })}
              onDelete={() => void run(async () => {
                await deleteCvEntry('cv_referees', row.id);
                if (ref.id === row.id) setRef(EMPTY_REFEREE);
              }, 'Could not remove that')}
            />
          ))}
          <Field label="Name" value={ref.name} onChangeText={(v) => setRef({ ...ref, name: v })} placeholder="Jane Muthoni" />
          <Field label="Title" value={ref.title} onChangeText={(v) => setRef({ ...ref, title: v })} placeholder="Head Teacher" />
          <Field label="Organisation" value={ref.organisation} onChangeText={(v) => setRef({ ...ref, organisation: v })} placeholder="Greenfield Academy" />
          <View className="flex-row gap-2">
            <View className="flex-1"><Field label="Phone" value={ref.phone} onChangeText={(v) => setRef({ ...ref, phone: v })} keyboardType="phone-pad" /></View>
            <View className="flex-1"><Field label="Email" value={ref.email} onChangeText={(v) => setRef({ ...ref, email: v })} keyboardType="email-address" /></View>
          </View>
          {draftActions(
            ref.id !== null,
            'Add referee',
            refMissing,
            () => void run(async () => {
              await saveReferee(withId({
                user_id: teacher.id,
                name: ref.name.trim(),
                title: orNull(ref.title),
                organisation: orNull(ref.organisation),
                phone: orNull(ref.phone),
                email: orNull(ref.email),
              }, ref.id));
              setRef(EMPTY_REFEREE);
            }, 'Could not save that referee'),
            () => setRef(EMPTY_REFEREE),
          )}
        </StepSection>

        {/* -------------------------------------------------------- the photo */}
        <StepSection {...foldProps('photo', photo === null ? 'Not added' : 'Added')}>
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
        </StepSection>

        {/* ------------------------------------------------------- visibility */}
        <View onLayout={layout('privacy')}>
          <CollapsibleSection
            title="Who can read it"
            summary={CV_VISIBILITY_LABEL[visibility]}
            why="This decides who may open your CV inside the app. It has no bearing on a file you download and send yourself."
            open={openSection === 'privacy'}
            onOpenChange={(next) => setOpenSection(next ? 'privacy' : null)}
          >
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
          </CollapsibleSection>
        </View>

        {/*
          The same action as the one in the card at the top. A teacher who has
          just finished the last section is at the bottom of a long page, and
          sending them back up to see what they made is how it stays unseen.
        */}
        <Button
          label="Preview and download"
          onPress={() => router.push('/profile/cv-preview')}
        />

        {/*
          The fields this screen deliberately does not own, and the way to
          reach them. It used to be a notice at the top saying where they came
          from, which is the same sentence without the door.
        */}
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Edit your profile"
          onPress={() => router.push('/profile/edit')}
        >
          <Card className="flex-row items-center gap-3 p-3.5">
            <View className="min-w-0 flex-1">
              <Text className="text-[12.5px] font-medium text-foreground">
                Name, subjects and TSC number
              </Text>
              <Text className="mt-0.5 text-[11px] leading-4 text-mutedForeground">
                These print on your CV and drive your match scores, so they live on your profile
                and cannot disagree with it. Edit them there.
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </Card>
        </Pressable>

        {busy ? <ActivityIndicator color={colors.mutedForeground} className="py-2" /> : null}
      </ScrollView>
    </View>
  );
}

/**
 * A row in the shape `orderExperience` sorts by, carrying the row itself.
 *
 * The ordering functions are generic over anything that has the fields they
 * read, so the editor sorts the real rows — ids and all — instead of sorting a
 * copy and then trying to find each original again by its title.
 */
function asOrderable(row: ExperienceRow) {
  return {
    organisation: row.organisation,
    role: row.role,
    startYear: row.start_year,
    endYear: row.end_year,
    isCurrent: row.is_current,
    description: row.description,
    row,
  };
}

function asOrderableEducation(row: EducationRow) {
  return {
    institution: row.institution,
    qualification: row.qualification,
    startYear: row.start_year,
    endYear: row.end_year,
    grade: row.grade,
    row,
  };
}
