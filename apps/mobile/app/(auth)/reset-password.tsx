import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { colors } from '@mwalimu/ui';
import { Button, centredContent, ErrorBanner } from '../../components/ui';
import { useAuth } from '../../lib/auth';

/**
 * Reached by opening the emailed link, which signs the teacher in with a
 * recovery session. The router sends them here — and only here — until the
 * password is changed or they sign out.
 */
export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { updatePassword, signOut, session } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tooShort = password.length > 0 && password.length < 6;
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = password.length >= 6 && confirm === password;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await updatePassword(password);
      // On success `recovering` clears, and the router moves on by itself —
      // to onboarding or to the app, depending on whether a profile exists.
      if (!result.ok) setError(result.reason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'New password' }} />
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, gap: 18, ...centredContent }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="gap-1.5">
          <Text className="text-[20px] font-medium tracking-tight text-foreground">
            Choose a new password
          </Text>
          <Text className="text-[13px] leading-5 text-mutedForeground">
            {session?.user.email === undefined
              ? 'Set a new password for your account.'
              : `For ${session.user.email}.`}
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">New password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
          />
          {tooShort ? (
            <Text className="text-[11px] text-destructiveForeground">
              Use at least 6 characters.
            </Text>
          ) : null}
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">Confirm it</Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Type it again"
            placeholderTextColor={colors.mutedForeground}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            onSubmitEditing={() => { if (ready) void submit(); }}
            className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
          />
          {/*
            Confirmation is here because the field is masked and a typo would
            otherwise lock someone out of the account they are mid-recovery on.
          */}
          {mismatch ? (
            <Text className="text-[11px] text-destructiveForeground">
              These do not match.
            </Text>
          ) : null}
        </View>

        {error !== null ? <ErrorBanner message={error} /> : null}

        {busy ? (
          <ActivityIndicator color={colors.mutedForeground} className="py-3" />
        ) : (
          <Button label="Save new password" disabled={!ready} onPress={() => void submit()} />
        )}

        <Button label="Cancel and sign out" variant="quiet" onPress={() => void signOut()} />
      </ScrollView>
    </View>
  );
}
