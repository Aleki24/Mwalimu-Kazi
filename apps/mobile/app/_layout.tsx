import { useEffect } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
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
  const { status, profileFault, signOut } = useAuth();

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-card">
        <ActivityIndicator color={colors.mutedForeground} />
      </View>
    );
  }

  /*
    A profile row that exists but will not parse gets said out loud, before any
    navigation. Treating it as "no profile" sent the teacher to onboarding,
    where saving the same shape fails again — a loop with nothing on screen
    explaining it. Signing out is the one action that helps, so it is the one
    offered.
  */
  if (status === 'profile-unreadable') {
    return (
      <View className="flex-1 justify-center gap-3 bg-card px-6">
        <Text className="text-lg font-medium text-foreground">
          We can’t read your profile
        </Text>
        <Text className="text-[13px] leading-5 text-mutedForeground">
          Your account is fine, but the profile saved against it does not match what
          this version of the app expects, so we would rather stop than show you
          something wrong.
        </Text>
        {profileFault === null ? null : (
          <Text className="text-[11.5px] leading-4 text-mutedForeground">
            {profileFault}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          className="mt-1 h-11 justify-center"
        >
          <Text className="text-[13px] font-medium text-primary">Sign out</Text>
        </Pressable>
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
        <Stack.Screen name="post/new" options={{ title: 'Post a role' }} />
        <Stack.Screen name="feed" options={{ title: 'Staffroom' }} />
        <Stack.Screen name="auto-apply" options={{ title: 'Auto-Apply' }} />
        <Stack.Screen name="messages/index" options={{ title: 'Messages' }} />
        <Stack.Screen name="messages/[threadId]" options={{ title: 'Conversation' }} />
        <Stack.Screen name="requests/index" options={{ title: 'Your requests' }} />
        <Stack.Screen name="recruiter/index" options={{ title: 'For schools' }} />
        <Stack.Screen name="recruiter/[schoolId]" options={{ title: 'Applicants' }} />
        <Stack.Screen name="profile/index" options={{ title: 'Your profile' }} />
        <Stack.Screen name="profile/edit" options={{ title: 'Edit profile' }} />
        <Stack.Screen name="profile/cv" options={{ title: 'Your CV' }} />
        <Stack.Screen name="profile/cv-preview" options={{ title: 'Preview' }} />
        <Stack.Screen name="applicant/[id]/cv" options={{ title: 'CV' }} />
        <Stack.Screen name="admin/index" options={{ title: 'Moderation' }} />
        <Stack.Screen name="admin/news" options={{ title: 'Publish an update' }} />
        <Stack.Screen name="news/[id]" options={{ title: 'Update' }} />
      </Stack.Protected>

      <Stack.Protected guard={status === 'needs-onboarding'}>
        <Stack.Screen name="(auth)/onboarding" options={{ headerShown: false }} />
      </Stack.Protected>

      {/*
        A recovery session is a real session, so this guard has to come before
        anything keyed on 'ready' — otherwise the link drops the teacher on
        Home and the email's promise is never kept.
      */}
      <Stack.Protected guard={status === 'recovering'}>
        <Stack.Screen name="(auth)/reset-password" />
      </Stack.Protected>

      <Stack.Protected guard={status === 'signed-out'}>
        <Stack.Screen name="(auth)/sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/forgot-password" />
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
