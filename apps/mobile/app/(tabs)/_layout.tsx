import { Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { colors, HIT_TARGET_MIN } from '@mwalimu/ui';

/**
 * The five tabs from the mockup. Community joins when its slice lands.
 *
 * Real icons rather than text glyphs: two tabs previously shared the same
 * character, which made the bar unreadable at a glance.
 */
const TABS = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'jobs', title: 'Jobs', icon: 'briefcase' },
  { name: 'resources', title: 'Resources', icon: 'folder' },
  { name: 'schools', title: 'Schools', icon: 'map-pin' },
  { name: 'profile', title: 'Profile', icon: 'user' },
] as const satisfies ReadonlyArray<{
  name: string;
  title: string;
  icon: React.ComponentProps<typeof Feather>['name'];
}>;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          minHeight: HIT_TARGET_MIN + 16,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color }) => <Feather name={tab.icon} size={20} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
