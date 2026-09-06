import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors, HIT_TARGET_MIN } from '@mwalimu/ui';

/**
 * Only the two tabs the Jobs slice needs. Schools, Community and Profile join
 * as their slices land — an empty tab is worse than an absent one.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, minHeight: HIT_TARGET_MIN + 16 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>⌂</Text>,
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: 'Jobs',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>▤</Text>,
        }}
      />
    </Tabs>
  );
}
