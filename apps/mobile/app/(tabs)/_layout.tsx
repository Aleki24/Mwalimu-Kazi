import { Tabs } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { View } from 'react-native';
import { FloatingTabBar } from '../../components/floating-tab-bar';
import { ComposeFab } from '../../components/compose-fab';
import { TopNav, useWideLayout, type NavDestination } from '../../components/web-nav';
import { useTeacher } from '../../lib/auth';

/**
 * Five tabs, and the rule for what earns one: a teacher opens it most days.
 * News is here because reading it is a daily habit and habits are what bring
 * someone back; Profile is not, because you edit a CV occasionally — it lives
 * behind the avatar in the Home header instead. Six tabs at 390px starts
 * truncating labels, so the bar stays at five.
 *
 * Real icons rather than text glyphs: two tabs previously shared the same
 * character, which made the bar unreadable at a glance.
 *
 * In a desktop browser the same five destinations move to a bar across the
 * top — see `components/web-nav`. The tabs themselves do not change; only
 * where the app draws the way between them.
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

/** The same five, as the top bar wants them: hrefs rather than child names. */
const DESTINATIONS = [
  { href: '/(tabs)', label: 'Home', icon: 'home' },
  { href: '/(tabs)/jobs', label: 'Jobs', icon: 'briefcase' },
  { href: '/(tabs)/news', label: 'News', icon: 'file-text' },
  { href: '/(tabs)/resources', label: 'Resources', icon: 'folder' },
  { href: '/(tabs)/schools', label: 'Schools', icon: 'map-pin' },
] as const satisfies readonly NavDestination[];

const ICONS = [
  { href: '/saved', label: 'Saved jobs', icon: 'bookmark' },
  { href: '/messages', label: 'Messages', icon: 'mail' },
  { href: '/notifications', label: 'Alerts', icon: 'bell' },
] as const satisfies readonly NavDestination[];

export default function TabsLayout() {
  const wide = useWideLayout();
  const teacher = useTeacher();

  return (
    // The FAB is mounted here rather than on Home so it appears on every tab,
    // once. It is a sibling of the navigator, not a screen inside it, so it
    // floats above whichever tab is showing.
    <View style={{ flex: 1 }}>
      {wide ? (
        <TopNav
          destinations={DESTINATIONS}
          icons={ICONS}
          name={teacher.fullName}
          profileHref="/profile"
        />
      ) : null}

      {/*
        The bar floats over the content, so it draws itself: tint, label and
        hit target all live in FloatingTabBar rather than being split between
        screenOptions here and a style override there.

        On a wide window it is not drawn at all — the navigator still owns the
        screens, but the way between them is the bar above.
      */}
      <Tabs
        tabBar={(props) => (wide ? null : <FloatingTabBar {...props} />)}
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

      {/*
        The compose button is a phone affordance: a thumb-sized circle pinned
        above the tab bar. With a mouse and a top bar there is nothing for it
        to float over, and every screen it leads to is one click away already.
      */}
      {wide ? null : <ComposeFab />}
    </View>
  );
}
