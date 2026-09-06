import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@mwalimu/ui';
import '../global.css';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.card },
          headerTitleStyle: { color: colors.foreground, fontWeight: '700' },
          headerTintColor: colors.primary,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="job/[id]" options={{ title: 'Job' }} />
        <Stack.Screen name="filters" options={{ title: 'Filters', presentation: 'modal' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
