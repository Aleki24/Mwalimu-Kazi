import { Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { View } from 'react-native';
import { FloatingTabBar } from '../../components/floating-tab-bar';
import { ComposeFab } from '../../components/compose-fab';

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
    // The FAB is mounted here rather than on Home so it appears on every tab,
    // once. It is a sibling of the navigator, not a screen inside it, so it
    // floats above whichever tab is showing.
    <View style={{ flex: 1 }}>
      {/*
        The bar floats over the content, so it draws itself: tint, label and
        hit target all live in FloatingTabBar rather than being split between
        screenOptions here and a style override there.
      */}
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarIcon: ({ color, size }) => <Feather name={tab.icon} size={size} color={color} />,
            }}
          />
        ))}
      </Tabs>
      <ComposeFab />
    </View>
  );
}
