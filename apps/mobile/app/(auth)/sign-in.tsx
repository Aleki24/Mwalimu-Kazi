import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { colors, radius, shadow } from '@mwalimu/ui';
import { Button, Card, centredContent, ErrorBanner, NoticeStrip } from '../../components/ui';
import { useWideLayout, widePage } from '../../components/web-nav';
import { useAuth } from '../../lib/auth';
import { RECOVERY_LINK_ERROR } from '../../lib/supabase';

/**
 * The front door, and on the web the whole shop window.
 *
 * On a phone this is a sign-in screen, because someone who downloaded an app
 * has already been sold. In a browser it is the first page anyone sees, and a
 * bare email box on an empty canvas tells a visitor nothing about what this
 * is or whether it is for them — so above the breakpoint the same screen lays
 * itself out as a landing page, with the form as the panel on the right.
 *
 * It speaks to both halves of the product. Parents can hold an account of
 * their own now, and a page that only talks about teaching careers would send
 * every one of them away before they reached the button.
 */

type Mode = 'sign-in' | 'sign-up';

/** Claims, each one something the product genuinely does. */
const FOR_TEACHERS = [
  'Roles matched to your subjects, county and TSC status',
  'What other teachers say about a school, before you apply',
  'One CV, built here, downloaded as PDF or Word',
] as const;

const FOR_PARENTS = [
  'Browse teachers who tutor near you',
  'Or post what your child needs and let teachers answer',
  'Talk in the app — your number stays yours until you give it',
] as const;

const input = 'h-12 rounded-lg border border-border bg-card px-3.5 text-[15px] text-foreground';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const wide = useWideLayout();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Seeded from the URL so a dead reset link explains itself here, which is
  // where the router sends you when one fails.
  const [error, setError] = useState<string | null>(RECOVERY_LINK_ERROR);
  const [busy, setBusy] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  // Deliberately loose. Validating addresses properly is famously impossible,
  // and a regex that rejects a real address is worse than one that lets a typo
  // through — the sign-in attempt will say so anyway.
  const looksLikeEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const ready = looksLikeEmail && password.length > 0;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = mode === 'sign-in'
        ? await signIn(email, password)
        : await signUp(email, password);

      if (!result.ok) { setError(result.reason); return; }
      // On success the router guard moves us on; nothing to do here except
      // handle the one case that leaves the teacher signed out on purpose.
      if ('needsConfirmation' in result) setConfirmSent(true);
    } finally {
      setBusy(false);
    }
  };

  if (confirmSent) {
    return (
      <View className="flex-1 justify-center gap-4 bg-background px-7">
        <Text className="text-center text-[17px] font-medium text-foreground">Check your email</Text>
        <Text className="text-center text-[13px] leading-5 text-mutedForeground">
          We sent a confirmation link to {email.trim().toLowerCase()}. Open it, then come back
          and sign in.
        </Text>
        <Button
          label="Back to sign in"
          variant="secondary"
          onPress={() => { setConfirmSent(false); setMode('sign-in'); setPassword(''); }}
        />
      </View>
    );
  }

  const form = (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="text-[17px] font-medium tracking-tight text-foreground">
          {mode === 'sign-in' ? 'Sign in' : 'Create your account'}
        </Text>
        <Text className="text-[12.5px] leading-[18px] text-mutedForeground">
          {mode === 'sign-in'
            ? 'Welcome back.'
            : 'You choose whether you are a teacher or a parent on the next screen.'}
        </Text>
      </View>

      <View className="gap-2">
        <Text className="text-[13px] font-medium text-foreground">Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          placeholderTextColor={colors.disabledForeground}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          keyboardType="email-address"
          inputMode="email"
          className={input}
        />
      </View>

      <View className="gap-2">
        <Text className="text-[13px] font-medium text-foreground">Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'sign-up' ? 'At least 6 characters' : 'Your password'}
          placeholderTextColor={colors.disabledForeground}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
          onSubmitEditing={() => { if (ready) void submit(); }}
          className={input}
        />
      </View>

      {error !== null ? <ErrorBanner message={error} /> : null}

      {busy ? (
        <ActivityIndicator color={colors.mutedForeground} className="py-3" />
      ) : (
        <Button
          label={mode === 'sign-in' ? 'Sign in' : 'Create account'}
          disabled={!ready}
          onPress={() => void submit()}
        />
      )}

      {mode === 'sign-in' ? (
        <Link href="/forgot-password" asChild>
          <Pressable accessibilityRole="link" className="items-center py-1">
            <Text className="text-[12.5px] text-mutedForeground">Forgot your password?</Text>
          </Pressable>
        </Link>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setError(null); }}
        className="items-center py-2"
      >
        <Text className="text-[13px] text-primary">
          {mode === 'sign-in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </Text>
      </Pressable>
    </View>
  );

  if (wide) {
    return (
      <View className="flex-1 bg-background">
        <View className="w-full border-b border-border bg-card">
          <View style={widePage} className="flex-row items-center justify-between px-6 py-3">
            <Wordmark />
            <Pressable
              accessibilityRole="button"
              onPress={() => { setMode('sign-in'); setError(null); }}
              style={{ borderRadius: radius.pill, minHeight: 36 }}
              className="justify-center px-4"
            >
              <Text className="text-[13px] font-medium text-primary">Sign in</Text>
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 32, ...widePage }}>
          <View className="flex-row items-start gap-10">
            <View className="min-w-0 flex-[1.2] gap-5 pt-6">
              <Text className="text-[13px] font-medium uppercase tracking-wider text-primary">
                Teaching work in Kenya
              </Text>
              <Text className="text-[44px] font-medium leading-[52px] tracking-tight text-foreground">
                Find teaching work.{'\n'}Or find a teacher.
              </Text>
              <Text className="max-w-[560px] text-[16px] leading-7 text-mutedForeground">
                Vacancies circulate on WhatsApp, and by the time most teachers hear about one the
                shortlist is closed. Mwalimu Kazi puts the roles, the schools behind them and the
                teachers who tutor in one place — for the people looking for work, and for the
                parents looking for someone to teach their child.
              </Text>

              <View className="mt-2 flex-row flex-wrap gap-3">
                <Audience icon="briefcase" title="For teachers" lines={FOR_TEACHERS} />
                <Audience icon="home" title="For parents" lines={FOR_PARENTS} />
              </View>

              <Text className="mt-1 text-[12px] leading-5 text-mutedForeground">
                Free for teachers and for parents. Your email is never shown to a school.
              </Text>
            </View>

            <View style={{ flexBasis: 400, flexGrow: 0, minWidth: 0 }}>
              <View
                style={[{ borderRadius: radius.xl3, borderCurve: 'continuous' }, shadow.floating]}
                className="border border-border bg-card p-6"
              >
                {form}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: insets.top + 40, gap: 20, ...centredContent }}
        keyboardShouldPersistTaps="handled"
      >
        {/*
          A hero, not an illustration. The reference designs lean on commissioned
          artwork we do not have, and a stock drawing of a classroom that is not
          a Kenyan classroom would say the wrong thing on the first screen a
          teacher sees. Type and the one accent carry it instead.
        */}
        <View className="gap-3">
          <Wordmark />

          <Text className="text-[30px] font-medium leading-9 tracking-tight text-foreground">
            Find teaching work.{'\n'}Or find a teacher.
          </Text>

          <Text className="text-[14px] leading-6 text-mutedForeground">
            Roles matched to what you actually teach, the schools behind them, and the teachers
            who tutor — whichever side of that you are on.
          </Text>

          <View className="mt-1 gap-2">
            {[
              ['target', 'Teachers: roles matched to your subjects and county'],
              ['shield', 'Teachers: school reviews, written by teachers'],
              ['home', 'Parents: find a tutor, or post what your child needs'],
            ].map(([icon, line]) => (
              <View key={line} className="flex-row items-center gap-2.5">
                <Feather
                  name={icon as React.ComponentProps<typeof Feather>['name']}
                  size={13}
                  color={colors.primary}
                />
                <Text className="flex-1 text-[12.5px] leading-4 text-mutedForeground">{line}</Text>
              </View>
            ))}
          </View>
        </View>

        {form}

        <NoticeStrip>
          <Text className="text-[11.5px] leading-4 text-mutedForeground">
            Your email is never shown to schools. They see your profile and the CV you choose to
            send, nothing else.
          </Text>
        </NoticeStrip>
      </ScrollView>
    </View>
  );
}

function Wordmark() {
  return (
    <View className="flex-row items-center gap-2">
      <View
        style={{ width: 26, height: 26, borderRadius: radius.sm, borderCurve: 'continuous' }}
        className="items-center justify-center bg-primary"
      >
        <Text className="text-[13px] font-medium text-primaryForeground">M</Text>
      </View>
      <Text className="text-[13px] font-medium tracking-tight text-foreground">
        Mwalimu Kazi
      </Text>
    </View>
  );
}

/** One half of the product, said in three lines it can back up. */
function Audience({
  icon, title, lines,
}: {
  readonly icon: React.ComponentProps<typeof Feather>['name'];
  readonly title: string;
  readonly lines: readonly string[];
}) {
  return (
    <View style={{ flexBasis: 260, flexGrow: 1, minWidth: 0 }}>
      <Card className="h-full gap-2.5 p-4">
        <View className="flex-row items-center gap-2">
          <View
            style={{ borderRadius: radius.lg }}
            className="h-8 w-8 items-center justify-center bg-primarySurface"
          >
            <Feather name={icon} size={15} color={colors.primary} />
          </View>
          <Text className="text-[14px] font-medium tracking-tight text-foreground">{title}</Text>
        </View>
        {lines.map((line) => (
          <View key={line} className="flex-row items-start gap-2">
            <Feather name="check" size={12} color={colors.success} style={{ marginTop: 3 }} />
            <Text className="flex-1 text-[12.5px] leading-[18px] text-mutedForeground">{line}</Text>
          </View>
        ))}
      </Card>
    </View>
  );
}
