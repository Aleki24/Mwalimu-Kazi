import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Image, type LayoutChangeEvent, Pressable, ScrollView, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import {
  CV_SECTIONS, CV_VISIBILITY_HINT, CV_VISIBILITY_LABEL, certificateWhen, cvReadiness, formatLabel,
  formatYearRange, isCvStep, movedSection, orderEducation, orderExperience, sectionsFrom,
  withRenamedSection, type CvSection, type CvSectionKey, type CvStepId,
} from '@mwalimu/core';
import { CvVisibility } from '@mwalimu/types';
import { colors, radius } from '@mwalimu/ui';
import {
  Button, Card, centredContent, Chip, ErrorBanner, Tag, ToggleRow, WhyDisabled,
} from '../../components/ui';
import { Field, FieldGrid, ReadOnlyField } from '../../components/form';
import { ListEditor } from '../../components/list-editor';
import { LanguageEditor } from '../../components/language-editor';
import { CvSectionCard } from '../../components/cv-section-card';
import { CvReadinessCard } from '../../components/cv-checklist';
import { useAuth, useTeacher } from '../../lib/auth';
import {
  cvFactsFrom, deleteCvEntry, EMPTY_CV, fetchCv, fetchPhotoDataUri, removePhoto, saveCertificate,
  saveCvDetails, saveCvPhotoPath, saveEducation, saveExperience, saveLanguage, saveReferee,
  saveSectionOrder, saveSkills, uploadPhoto, type CertificateRow, type CvRecord,
  type EducationRow, type ExperienceRow, type RefereeRow,
} from '../../lib/cv';
import { pickPhoto } from '../../lib/pick-photo';

/**
 * The CV editor.
 *
 * One card per section of the document, in the order the document prints them.
 * That is the whole organising idea, and it replaces two things that used to
 * fight each other: a form whose folds were named after database tables, and a
 * separate "Sections" list where the headings and the order were really
 * decided. A teacher who wanted "Employment" to say "Work Experience" had to
 * find a list of section names that edited nothing else — now they tap the
 * heading and type.
 *
 * The checklist at the top says how far along the document is and what a
 * school reads first; each of its rows opens the card that answers it. One
 * card is open at a time, and the drafts live on this screen rather than
 * inside the cards, so closing one to look at another never loses what was
 * typed into it.
 */

/** What can be open: any section of the CV, plus the one card that is not one. */
type OpenSection = CvSectionKey | 'privacy';

/**
 * The card a checklist row opens.
 *
 * Every step is a section of its own except the photograph, which is part of
 * the personal details the templates print it beside.
 */
const cardFor = (step: CvStepId): CvSectionKey => (step === 'photo' ? 'personal' : step);

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
      <View
        style={{ borderRadius: radius.lg }}
        className="flex-row items-center gap-2 bg-destructiveSurface px-3 py-1.5"
      >
        <Text numberOfLines={1} className="min-w-0 flex-1 text-[11.5px] text-foreground">
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
    <View
      style={{ borderRadius: radius.lg, borderWidth: 1, borderColor: editing ? colors.ring : 'transparent' }}
      className={`flex-row items-center gap-2 px-3 ${editing ? 'bg-card' : 'bg-wash'}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Edit ${title}`}
        onPress={onEdit}
        className="min-h-[44px] min-w-0 flex-1 flex-row items-center gap-2 py-2"
      >
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-[13px] font-medium text-foreground">{title}</Text>
          {subtitle === '' ? null : (
            <Text numberOfLines={1} className="text-[11.5px] text-mutedForeground">{subtitle}</Text>
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
        className="min-h-[44px] w-7 items-center justify-center"
      >
        <Feather name="x" size={15} color={colors.mutedForeground} />
      </Pressable>
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
  const [sections, setSections] = useState<readonly CvSection[]>(() => sectionsFrom([]));
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Which card is open. One at a time: the checklist points at a section, and
  // pointing at something only works if the rest are out of the way.
  const [openSection, setOpenSection] = useState<OpenSection | null>(null);
  const scroller = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<OpenSection, number>>>({});
  // The card waiting to be scrolled to once it has finished opening. A ref
  // rather than state: nothing renders differently because of it.
  const pendingScroll = useRef<OpenSection | null>(null);

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
      setSections(sectionsFrom(record.sections.map((r) => ({ key: r.section, title: r.title }))));
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

  /**
   * A rename or a move: shown at once, written behind it.
   *
   * Every row carries its position, so the whole list is written rather than
   * the one row that moved — two sections claiming the same place would leave
   * the order decided by whichever the database returned first.
   */
  const saveOrder = (next: readonly CvSection[]) => {
    setSections(next);
    void persist(
      () => saveSectionOrder(teacher.id, next),
      'Could not save that heading',
    );
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

  const scrollTo = (y: number | undefined) => {
    if (y === undefined) return;
    scroller.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
  };

  /**
   * Open a card and bring it into view.
   *
   * The scroll waits for it to finish opening: the card above may be closing
   * at the same moment, and a position measured before that lands a hundred
   * points off. `onLayout` fires once the new geometry is settled, which is
   * where the scroll is actually issued.
   */
  const reveal = (id: OpenSection) => {
    const alreadyOpen = openSection === id;
    setOpenSection(id);
    if (alreadyOpen) scrollTo(offsets.current[id]);
    else pendingScroll.current = id;
  };

  const layout = (id: OpenSection) => (event: LayoutChangeEvent) => {
    const { y } = event.nativeEvent.layout;
    offsets.current[id] = y;
    if (pendingScroll.current !== id) return;
    pendingScroll.current = null;
    scrollTo(y);
  };

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

  const roles = cv.experience.filter((e) => !e.is_volunteer);
  const volunteering = cv.experience.filter((e) => e.is_volunteer);

  /**
   * What a closed card says about itself. Never a bare "0".
   *
   * The plural is given rather than guessed: appending "s" turned "entry" into
   * "4 entrys" on the first screen anyone looked at.
   */
  const counted = (n: number, one: string, many: string): string =>
    (n === 0 ? 'Empty' : `${n} ${n === 1 ? one : many}`);
  const filled = (...values: readonly string[]): string => {
    const done = values.filter((v) => v.trim() !== '').length;
    return done === 0 ? 'Empty' : `${done} of ${values.length} filled in`;
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
      <FieldGrid>
        <Field label={words.role} value={draft.role} onChangeText={(v) => set({ ...draft, role: v })} placeholder={words.rolePlaceholder} />
        <Field label={words.where} value={draft.organisation} onChangeText={(v) => set({ ...draft, organisation: v })} placeholder={words.wherePlaceholder} />
        <Field label="From" value={draft.start} onChangeText={(v) => set({ ...draft, start: v })} keyboardType="number-pad" placeholder="2019" />
        {draft.current ? null : (
          <Field label="To" value={draft.end} onChangeText={(v) => set({ ...draft, end: v })} keyboardType="number-pad" placeholder="2022" />
        )}
      </FieldGrid>
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
        variant={editing ? 'primary' : 'secondary'}
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

  /** A section with nothing in it yet, said once rather than left blank. */
  const nothingYet = (words: string) => (
    <Text className="text-[11.5px] leading-4 text-disabledForeground">{words}</Text>
  );

  const summaryFor = (key: CvSectionKey): string => {
    switch (key) {
      case 'personal': return filled(phone, email, address, location);
      case 'profile': return summary.trim() === '' ? 'Empty' : 'Written';
      case 'employment': return counted(roles.length, 'role', 'roles');
      case 'education': return counted(cv.education.length, 'qualification', 'qualifications');
      case 'certificates': return counted(cv.certificates.length, 'certificate', 'certificates');
      case 'skills': return counted(skills.length, 'skill', 'skills');
      case 'languages': return counted(cv.languages.length, 'language', 'languages');
      case 'hobbies': return counted(hobbies.length, 'hobby', 'hobbies');
      case 'responsibilities': return counted(responsibilities.length, 'entry', 'entries');
      case 'volunteer': return counted(volunteering.length, 'entry', 'entries');
      case 'referees': return counted(cv.referees.length, 'referee', 'referees');
      case 'subjects': return counted(teacher.subjects.length, 'subject', 'subjects');
    }
  };

  const bodyFor = (key: CvSectionKey): ReactNode => {
    switch (key) {
      case 'personal': return (
        <>
          <View className="flex-row gap-3">
            {/*
              The photograph sits where it prints: at the top of the personal
              details, beside the name, rather than in a section of its own
              three folds away from anything it relates to.
            */}
            <View className="gap-1.5">
              {photo === null ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Choose a photograph"
                  onPress={choosePhoto}
                  style={{ borderRadius: radius.lg }}
                  className="h-[84px] w-[66px] items-center justify-center border border-dashed border-border bg-wash"
                >
                  <Feather name="camera" size={17} color={colors.mutedForeground} />
                  <Text className="mt-1 text-[9.5px] text-mutedForeground">Photo</Text>
                </Pressable>
              ) : (
                <Image
                  source={{ uri: photo }}
                  style={{ width: 66, height: 84, borderRadius: radius.lg }}
                  accessibilityLabel="Your CV photograph"
                />
              )}
              <Pressable
                accessibilityRole="button"
                onPress={photo === null ? choosePhoto : clearPhoto}
                className="min-h-[24px] items-center justify-center"
              >
                <Text className="text-[10.5px] font-medium text-mutedForeground">
                  {photo === null ? 'Add' : 'Remove'}
                </Text>
              </Pressable>
            </View>

            <View className="min-w-0 flex-1">
              <FieldGrid>
                <ReadOnlyField
                  label="Full name"
                  value={teacher.fullName}
                  placeholder="From your profile"
                  span="full"
                  onPress={() => router.push('/profile/edit')}
                />
                <ReadOnlyField
                  label="Headline"
                  value={teacher.headline ?? ''}
                  placeholder="Mathematics & Physics teacher"
                  span="full"
                  onPress={() => router.push('/profile/edit')}
                />
              </FieldGrid>
            </View>
          </View>

          <FieldGrid>
            <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+254 712 345678" />
            <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="you@example.com" />
            <Field label="Address" value={address} onChangeText={setAddress} placeholder="P.O. Box 132-50311" maxLength={200} span="full" />
            <Field label="Post code" value={postCode} onChangeText={setPostCode} placeholder="50311" maxLength={20} />
            <Field label="City or town" value={location} onChangeText={setLocation} placeholder="Nairobi" />
            <Field
              label="Date of birth"
              value={dob}
              onChangeText={setDob}
              placeholder="23/12/1996"
              invalid={dobUnreadable}
              hint={dobUnreadable ? 'Write it as 23/12/1996 or 1996-12-23.' : undefined}
            />
            <Field label="Gender" value={gender} onChangeText={setGender} placeholder="Female" maxLength={40} />
            <Field label="Nationality" value={nationality} onChangeText={setNationality} placeholder="Kenyan" maxLength={60} />
          </FieldGrid>

          <Button
            label="Save personal details"
            variant="secondary"
            disabled={dobUnreadable}
            onPress={() => void run(
              () => saveCvDetails(teacher.id, {
                email: orNull(email), phone: orNull(phone), location: orNull(location),
                address: orNull(address), post_code: orNull(postCode),
                date_of_birth: isoDate(dob), gender: orNull(gender),
                nationality: orNull(nationality),
              }),
              'Could not save your personal details',
            )}
          />
          <WhyDisabled missing={dobUnreadable ? ['a date it can read'] : []} />
        </>
      );

      case 'profile': return (
        <>
          <Field
            label="Your profile"
            value={summary}
            onChangeText={setSummary}
            multiline
            maxLength={1200}
            placeholder="Two or three sentences: what you teach, how long, and what you are looking for."
          />
          <Button
            label="Save profile"
            variant="secondary"
            onPress={() => void run(
              () => saveCvDetails(teacher.id, { summary: orNull(summary) }),
              'Could not save that',
            )}
          />
        </>
      );

      case 'employment': return (
        <>
          {roles.length === 0 ? nothingYet('No roles yet. The most recent one goes at the top of the printed CV.') : null}
          {orderExperience(roles.map(asOrderableRole)).map(({ row }) => (
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
        </>
      );

      case 'education': return (
        <>
          {cv.education.length === 0 ? nothingYet('No qualifications yet.') : null}
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
          <FieldGrid>
            <Field label="Qualification" value={edu.qualification} onChangeText={(v) => setEdu({ ...edu, qualification: v })} placeholder="B.Ed (Science)" />
            <Field label="Institution" value={edu.institution} onChangeText={(v) => setEdu({ ...edu, institution: v })} placeholder="University of Nairobi" />
            <Field label="From" value={edu.start} onChangeText={(v) => setEdu({ ...edu, start: v })} keyboardType="number-pad" placeholder="2012" />
            <Field label="To" value={edu.end} onChangeText={(v) => setEdu({ ...edu, end: v })} keyboardType="number-pad" placeholder="2016" />
            <Field label="Grade (optional)" value={edu.grade} onChangeText={(v) => setEdu({ ...edu, grade: v })} placeholder="Second Class Upper" span="full" />
          </FieldGrid>
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
        </>
      );

      case 'certificates': return (
        <>
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
          <FieldGrid>
            <Field label="Certificate" value={cert.title} onChangeText={(v) => setCert({ ...cert, title: v })} placeholder="Certificate in computer packages" maxLength={160} span="full" />
            {cert.ongoing ? null : (
              <Field label="Year (optional)" value={cert.year} onChangeText={(v) => setCert({ ...cert, year: v })} keyboardType="number-pad" placeholder="2016" />
            )}
          </FieldGrid>
          <Field label="Where (optional)" value={cert.description} onChangeText={(v) => setCert({ ...cert, description: v })} placeholder="Probation Community Resource & Training Centre, Webuye" maxLength={400} multiline />
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
        </>
      );

      case 'skills': return (
        <>
          <ListEditor label="Skills" items={skills} onChange={editSkills} placeholder="Computer packages" />
          <Text className="text-[10.5px] leading-4 text-mutedForeground">
            These save as you add them, and they are the same skills the matcher reads.
          </Text>
        </>
      );

      case 'languages': return (
        <LanguageEditor
          items={cv.languages}
          onAdd={(name) => void run(
            () => saveLanguage({ user_id: teacher.id, name }), 'Could not add that language')}
          onLevel={(row, level) => void run(
            () => saveLanguage({ ...row, level }), 'Could not save that')}
          onRemove={(row) => void run(
            () => deleteCvEntry('cv_languages', row.id), 'Could not remove that')}
        />
      );

      case 'hobbies': return (
        <ListEditor
          label="Hobbies"
          items={hobbies}
          onChange={editList('hobbies', setHobbies)}
          placeholder="Reading novels"
        />
      );

      case 'responsibilities': return (
        <ListEditor
          label="Positions of responsibility"
          items={responsibilities}
          onChange={editList('responsibilities', setResponsibilities)}
          placeholder="Class teacher, Form 4G"
        />
      );

      case 'volunteer': return (
        <>
          {orderExperience(volunteering.map(asOrderableRole)).map(({ row }) => (
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
        </>
      );

      case 'referees': return (
        <>
          <Text className="text-[11px] leading-4 text-mutedForeground">
            Only the people you actually apply to ever see these, whatever the visibility card
            says. A referee agreed to vouch for you, not to be in a directory.
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
          <FieldGrid>
            <Field label="Name" value={ref.name} onChangeText={(v) => setRef({ ...ref, name: v })} placeholder="Jane Muthoni" />
            <Field label="Title" value={ref.title} onChangeText={(v) => setRef({ ...ref, title: v })} placeholder="Head Teacher" />
            <Field label="Organisation" value={ref.organisation} onChangeText={(v) => setRef({ ...ref, organisation: v })} placeholder="Greenfield Academy" span="full" />
            <Field label="Phone" value={ref.phone} onChangeText={(v) => setRef({ ...ref, phone: v })} keyboardType="phone-pad" placeholder="+254 712 345678" />
            <Field label="Email" value={ref.email} onChangeText={(v) => setRef({ ...ref, email: v })} keyboardType="email-address" placeholder="jane@example.com" />
          </FieldGrid>
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
        </>
      );

      case 'subjects': return (
        <>
          {teacher.subjects.length === 0
            ? nothingYet('No subjects on your profile yet.')
            : (
              <View className="flex-row flex-wrap gap-1.5">
                {teacher.subjects.map((s) => <Tag key={s} label={formatLabel(s)} />)}
              </View>
            )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit your subjects on your profile"
            onPress={() => router.push('/profile/edit')}
            className="min-h-[44px] flex-row items-center gap-1.5"
          >
            <Feather name="edit-2" size={12} color={colors.primary} />
            <Text className="text-[12px] font-medium text-primary">Edit on your profile</Text>
          </Pressable>
          <Text className="text-[10.5px] leading-4 text-mutedForeground">
            Your subjects and TSC number print here and drive your match scores, so they live
            on your profile and cannot disagree with it.
          </Text>
        </>
      );
    }
  };

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
          onOpenStep={(step) => reveal(cardFor(step))}
          onPreview={() => router.push('/profile/cv-preview')}
        />

        {/*
          One card per section of the document, in the order it prints. The
          order is the teacher's, so this list is theirs to rearrange rather
          than a fixed sequence with a separate list of names beside it.
        */}
        {sections.map((section, index) => {
          const step = isCvStep(section.key) ? readiness.byId[section.key] : undefined;
          return (
            <View key={section.key} onLayout={layout(section.key)}>
              <CvSectionCard
                title={section.title}
                defaultTitle={CV_SECTIONS[section.key]}
                summary={summaryFor(section.key)}
                why={step?.why}
                status={step === undefined
                  ? undefined
                  : { done: step.done, essential: step.essential }}
                open={openSection === section.key}
                onOpenChange={(next) => setOpenSection(next ? section.key : null)}
                onRename={(title) => saveOrder(withRenamedSection(sections, section.key, title))}
                onMove={(delta) => saveOrder(movedSection(sections, section.key, delta))}
                canMoveUp={index > 0}
                canMoveDown={index < sections.length - 1}
              >
                {bodyFor(section.key)}
              </CvSectionCard>
            </View>
          );
        })}

        {/*
          Not a section of the document, so it carries no heading to rename and
          no place in the order — it decides who may open the CV inside the app.
        */}
        <View onLayout={layout('privacy')}>
          <CvSectionCard
            title="Who can read it"
            defaultTitle="Who can read it"
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
          </CvSectionCard>
        </View>

        {/*
          The same action as the one in the card at the top. A teacher who has
          just finished the last section is at the bottom of a long page, and
          sending them back up to see what they made is how it stays unseen.
        */}
        <Button
          label="Preview and download"
          onPress={() => router.push('/profile/cv-preview')}
          className="mt-1"
        />

        {busy ? <ActivityIndicator color={colors.mutedForeground} className="py-2" /> : null}
      </ScrollView>
    </View>
  );
}

/**
 * A row in the shape `orderExperience` sorts by, carrying the row itself.
 *
 * The ordering functions are generic over the entry, so the editor sorts the
 * real rows — ids and all — instead of sorting a copy and then trying to find
 * each original again by its title.
 */
function asOrderableRole(row: ExperienceRow) {
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
