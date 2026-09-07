import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import { colors } from '@mwalimu/ui';
import { Button, ErrorBanner, NoticeStrip } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { RECOVERY_LINK_ERROR } from '../../lib/supabase';

type Mode = 'sign-in' | 'sign-up';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
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

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: insets.top + 48, gap: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-1.5">
          <Text className="text-[26px] font-medium tracking-tight text-foreground">Mwalimu Kazi</Text>
          <Text className="text-[13.5px] leading-5 text-mutedForeground">
            {mode === 'sign-in'
              ? 'Sign in to see roles matched to what you actually teach.'
              : 'Create an account. It takes a minute, and you can browse jobs either way.'}
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
          />
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={mode === 'sign-up' ? 'At least 6 characters' : 'Your password'}
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
            onSubmitEditing={() => { if (ready) void submit(); }}
            className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
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
