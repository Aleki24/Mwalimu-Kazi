import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { colors } from '@mwalimu/ui';
import { Button, ErrorBanner, NoticeStrip } from '../../components/ui';
import { useAuth } from '../../lib/auth';

export default function ForgotPasswordScreen() {
  const insets = useSafeAreaInsets();
  const { requestPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const ready = /^\S+@\S+\.\S+$/.test(email.trim());

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await requestPasswordReset(email);
      // Shown whether or not the address has an account. Saying "no account
      // with that email" would let anyone test which teachers are registered
      // here, and the reviews on this app are written by people who need that
      // not to be discoverable.
      if (result.ok) setSent(true);
      else setError(result.reason);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <View className="flex-1 justify-center gap-4 bg-background px-7">
        <Stack.Screen options={{ title: 'Check your email' }} />
        <Text className="text-center text-[17px] font-medium text-foreground">Check your email</Text>
        <Text className="text-center text-[13px] leading-5 text-mutedForeground">
          If {email.trim().toLowerCase()} has an account, a reset link is on its way. It expires
          after an hour.
        </Text>
        <Button label="Back to sign in" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Reset password' }} />
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingTop: insets.top + 24, gap: 18 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className="text-[13.5px] leading-5 text-mutedForeground">
          Enter the email you signed up with and we will send a link to set a new password.
        </Text>

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
            onSubmitEditing={() => { if (ready) void submit(); }}
            className="h-12 rounded-md border border-border bg-card px-3.5 text-[15px] text-foreground"
          />
        </View>

        {error !== null ? <ErrorBanner message={error} /> : null}

        {busy ? (
          <ActivityIndicator color={colors.mutedForeground} className="py-3" />
        ) : (
          <Button label="Send reset link" disabled={!ready} onPress={() => void submit()} />
        )}

        <NoticeStrip>
          <Text className="text-[11.5px] leading-4 text-mutedForeground">
            Nothing about your account changes until you open the link and choose a new password.
          </Text>
        </NoticeStrip>
      </ScrollView>
    </View>
  );
}
