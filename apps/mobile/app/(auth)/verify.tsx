import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatPhoneForDisplay } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { useAuth } from '../../lib/auth';

const RESEND_SECONDS = 30;

export default function VerifyScreen() {
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { verifyOtp, sendOtp } = useAuth();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    const timer = setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { input.current?.focus(); }, []);

  const submit = async (value: string) => {
    setBusy(true);
    setError(null);
    const result = await verifyOtp(phone, value);
    setBusy(false);

    if (!result.ok) {
      setError(result.reason);
      setCode('');
      return;
    }
    // No navigation here: Stack.Protected in app/_layout.tsx swaps the tree as
    // soon as `status` changes, to onboarding or the tabs as appropriate.
  };

  const resend = async () => {
    setCooldown(RESEND_SECONDS);
    setError(null);
    const result = await sendOtp(phone);
    if (!result.ok) setError(result.reason);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 32, gap: 24 }}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} className="h-11 justify-center">
          <Text className="text-[15px] font-medium text-foreground">← Change number</Text>
        </Pressable>

        <View>
          <Text className="text-2xl font-medium tracking-tight text-foreground">
            Enter the code
          </Text>
          {/* Showing the number back catches a typo before they sit waiting. */}
          <Text className="mt-2 text-[15px] text-mutedForeground">
            Sent to {formatPhoneForDisplay(phone ?? '')}
          </Text>
        </View>

        <View className="gap-2">
          <TextInput
            ref={input}
            value={code}
            onChangeText={(next) => {
              const digits = next.replace(/\D/g, '').slice(0, 6);
              setCode(digits);
              setError(null);
              if (digits.length === 6) void submit(digits);
            }}
            placeholder="000000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            maxLength={6}
            className={`h-16 rounded-md border bg-card px-4 text-center text-3xl font-medium tracking-[8px] text-foreground ${
              error === null ? 'border-border' : 'border-destructive'
            }`}
          />
          {error !== null ? <Text className="text-[12.5px] text-destructiveForeground">{error}</Text> : null}
          {busy ? <ActivityIndicator color={colors.mutedForeground} /> : null}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={cooldown > 0}
          onPress={() => void resend()}
          className="h-11 justify-center"
        >
          <Text className={`text-[14px] font-medium ${cooldown > 0 ? 'text-mutedForeground' : 'text-foreground'}`}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
