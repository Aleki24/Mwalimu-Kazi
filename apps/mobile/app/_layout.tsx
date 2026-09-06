import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@mwalimu/ui';
import { AuthProvider, useAuth } from '../lib/auth';
import '../global.css';

/**
 * Route guard.
 *
 * `Stack.Protected` rather than a redirect in an effect: a false guard means the
 * screen is never mounted at all. An effect redirect still renders the
 * protected screen once first, which crashed on `useTeacher()` before the
 * navigation landed.
 *
 * Three states, three exclusive groups — "signed in but no profile row yet" is
 * a real state, not an edge case, because profiles.full_name and county are NOT
 * NULL and cannot be created by trigger.
 */
function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { color: colors.foreground, fontWeight: '700' },
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={status === 'ready'}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="job/[id]" options={{ title: 'Job' }} />
        <Stack.Screen name="school/[slug]" options={{ title: 'School' }} />
        <Stack.Screen name="news" options={{ title: 'News & updates' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="saved" options={{ title: 'Saved jobs' }} />
      </Stack.Protected>

      <Stack.Protected guard={status === 'needs-onboarding'}>
        <Stack.Screen name="(auth)/onboarding" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={status === 'signed-out'}>
        <Stack.Screen name="(auth)/sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/verify" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
