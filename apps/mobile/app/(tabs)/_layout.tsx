import { Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { colors, HIT_TARGET_MIN } from '@mwalimu/ui';

/**
 * Five tabs, and the rule for what earns one: a teacher opens it most days.
 * News is here because reading it is a daily habit and habits are what bring
 * someone back; Profile is not, because you edit a CV occasionally — it lives
 * behind the avatar in the Home header instead. Six tabs at 390px starts
 * truncating labels, so the bar stays at five.
 *
 * Real icons rather than text glyphs: two tabs previously shared the same
 * character, which made the bar unreadable at a glance.
 */
const TABS = [
  { name: 'index', title: 'Home', icon: 'home' },
  { name: 'jobs', title: 'Jobs', icon: 'briefcase' },
  { name: 'news', title: 'News', icon: 'file-text' },
  { name: 'resources', title: 'Resources', icon: 'folder' },
  { name: 'schools', title: 'Schools', icon: 'map-pin' },
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
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          minHeight: HIT_TARGET_MIN + 16,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500', fontFamily: 'InterTight_500Medium' },
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
