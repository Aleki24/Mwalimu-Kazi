import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@mwalimu/ui';
import { useAuth } from '../../lib/auth';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { sendOtp } = useAuth();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    setError(null);
    const result = await sendOtp(phone);
    setSending(false);

    if (!result.ok) {
      setError(result.reason);
      return;
    }
    router.push({ pathname: '/(auth)/verify', params: { phone: result.e164 } });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top }}
    >
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 48, gap: 24 }}>
        <View>
          <Text className="text-3xl font-medium tracking-tight text-foreground">
            Mwalimu Kazi
          </Text>
          <Text className="mt-2 text-[15px] leading-5 text-mutedForeground">
            Teaching jobs, and what a school is really like before you accept.
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-[13px] font-medium text-foreground">Phone number</Text>
          <TextInput
            value={phone}
            onChangeText={(next) => { setPhone(next); setError(null); }}
            placeholder="0712 345 678"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="go"
            onSubmitEditing={() => { if (!sending) void submit(); }}
            className={`h-14 rounded-md border bg-card px-4 text-base text-foreground ${
              error === null ? 'border-border' : 'border-destructive'
            }`}
          />
          {error !== null ? (
            <Text className="text-[12.5px] text-destructiveForeground">{error}</Text>
          ) : (
            <Text className="text-[12.5px] text-mutedForeground">
              We will text you a 6-digit code. Kenyan numbers only for now.
            </Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={sending || phone.trim() === ''}
          onPress={() => void submit()}
          className={`h-14 items-center justify-center rounded-md ${
            sending || phone.trim() === '' ? 'bg-wash' : 'bg-primary'
          }`}
        >
          {sending ? (
            <ActivityIndicator color={colors.mutedForeground} />
          ) : (
            <Text
              className={`text-base font-medium ${
                phone.trim() === '' ? 'text-mutedForeground' : 'text-primaryForeground'
              }`}
            >
              Send code
            </Text>
          )}
        </Pressable>

        <Text className="text-[11.5px] leading-4 text-mutedForeground">
          Your number identifies your account. It is never shown to schools.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
