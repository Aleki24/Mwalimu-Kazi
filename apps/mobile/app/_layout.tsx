import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  InterTight_300Light, InterTight_400Regular, InterTight_500Medium, useFonts,
} from '@expo-google-fonts/inter-tight';
import { colors } from '@mwalimu/ui';
import { AuthProvider, useAuth } from '../lib/auth';
import '../global.css';

void SplashScreen.preventAutoHideAsync();

/**
 * Route guard.
 *
 * `Stack.Protected` rather than a redirect in an effect: a false guard means the
 * screen is never mounted at all. An effect redirect still renders the
 * protected screen once first, which crashed on `useTeacher()` before the
 * navigation landed.
 */
function RootNavigator() {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-card">
        <ActivityIndicator color={colors.mutedForeground} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: {
          color: colors.foreground,
          fontFamily: 'InterTight_500Medium',
          fontSize: 16,
        },
        headerTintColor: colors.foreground,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={status === 'ready'}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="job/[id]" options={{ title: 'Job' }} />
        <Stack.Screen name="school/[slug]" options={{ title: 'School' }} />
        <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        <Stack.Screen name="saved" options={{ title: 'Saved' }} />
        <Stack.Screen name="applications" options={{ title: 'Applications' }} />
        <Stack.Screen name="review/new" options={{ title: 'Write a review' }} />
        <Stack.Screen name="profile" options={{ title: 'Your profile' }} />
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
  const [fontsLoaded] = useFonts({
    InterTight_300Light, InterTight_400Regular, InterTight_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
