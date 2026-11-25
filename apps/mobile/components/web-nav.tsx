import { Platform, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { Link, usePathname, router } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { colors, radius, shadow } from '@mwalimu/ui';
import { Avatar, type ContentWidth } from './ui';

/**
 * The web build's own chrome.
 *
 * On a phone this product is an app: a floating tab bar at the bottom, one
 * column, a thumb's reach. In a desktop browser that same layout reads as a
 * phone screenshot pinned to the middle of a 1440px page — the navigation sits
 * at the bottom where no mouse goes, and the other two thirds of the window
 * are empty canvas.
 *
 * So above `WIDE` the web build wears website furniture instead: navigation
 * along the top, where a browser has put it for thirty years, and content that
 * uses the width. Nothing here loads on a device — `useWideLayout` is false on
 * iOS and Android whatever the screen measures, because a tablet held in two
 * hands is still an app.
 */

/** Where a browser window stops being a phone. */
export const WIDE = 900;

export function useWideLayout(): boolean {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WIDE;
}

/** The reading column on a wide page: wide enough for three cards abreast. */
export const PAGE_MAX_WIDTH = 1080;

export const widePage = {
  width: '100%',
  maxWidth: PAGE_MAX_WIDTH,
  alignSelf: 'center',
} as const satisfies ContentWidth;

/**
 * A list that is one column on a phone and as many as fit on a desktop.
 *
 * Spread onto each child, not the container: the row wraps, and each card
 * declares the narrowest it is willing to be. No width listener, no
 * breakpoint, and the same code on both.
 */
export const gridItem = (basis = 320) => ({
  flexBasis: basis,
  flexGrow: 1,
  // Without this a long title sets the basis and the row never wraps.
  minWidth: 0,
});

/**
 * The router's own href type, not `string`: typed routes are on, so a typo in
 * a destination fails the build rather than rendering a link to nowhere.
 */
export type Href = React.ComponentProps<typeof Link>['href'];

export interface NavDestination {
  readonly href: Href;
  readonly label: string;
  readonly icon: React.ComponentProps<typeof Feather>['name'];
}

/**
 * Whether a nav link is the page being looked at.
 *
 * A group segment is not part of the URL, so `/(tabs)/jobs` is `/jobs` once
 * the router has resolved it, and comparing the two raw would light nothing.
 */
function isCurrent(pathname: string, href: Href): boolean {
  const target = String(href).replace('/(tabs)', '');
  if (target === '/') return pathname === '/';
  return pathname === target || pathname.startsWith(`${target}/`);
}

function NavLink({ destination, current }: {
  readonly destination: NavDestination;
  readonly current: boolean;
}) {
  return (
    <Link href={destination.href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityState={{ selected: current }}
        style={{ borderRadius: radius.pill, minHeight: 38 }}
        className={`flex-row items-center gap-2 px-3.5 ${current ? 'bg-primarySurface' : ''}`}
      >
        <Feather
          name={destination.icon}
          size={15}
          color={current ? colors.primary : colors.mutedForeground}
        />
        <Text
          className={`text-[13.5px] ${
            current ? 'font-medium text-primary' : 'text-mutedForeground'
          }`}
        >
          {destination.label}
        </Text>
      </Pressable>
    </Link>
  );
}

/** A quiet round icon button, with a dot when something is waiting. */
function NavIcon({ href, icon, label }: {
  readonly href: Href;
  readonly icon: React.ComponentProps<typeof Feather>['name'];
  readonly label: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={label}
        style={{ borderRadius: 999 }}
        className="h-10 w-10 items-center justify-center"
      >
        <Feather name={icon} size={18} color={colors.mutedForeground} />
      </Pressable>
    </Link>
  );
}

/**
 * The bar across the top of every signed-in page on a wide browser window.
 *
 * Full-bleed white with the content capped at the page width, so the bar
 * spans the window while its contents line up with the page underneath —
 * a bar that stopped at 1080px would read as a floating card, and a page
 * whose navigation does not touch the edges of the window does not read as a
 * website.
 */
export function TopNav({
  destinations, icons, name, profileHref,
}: {
  readonly destinations: readonly NavDestination[];
  /** The round buttons on the right. A parent has no saved jobs. */
  readonly icons: readonly NavDestination[];
  readonly name: string;
  readonly profileHref: Href;
}) {
  const pathname = usePathname();

  return (
    <View
      style={[{ zIndex: 10 }, shadow.resting]}
      className="w-full border-b border-border bg-card"
    >
      <View style={widePage} className="flex-row items-center gap-2 px-6 py-2.5">
        <Link href="/" asChild>
          <Pressable accessibilityRole="link" accessibilityLabel="Mwalimu Kazi, home" className="pr-4">
            <Text className="text-[16px] font-medium tracking-tight text-primary">
              Mwalimu Kazi
            </Text>
          </Pressable>
        </Link>

        <View className="min-w-0 flex-1 flex-row items-center gap-1">
          {destinations.map((destination) => (
            <NavLink
              key={destination.label}
              destination={destination}
              current={isCurrent(pathname, destination.href)}
            />
          ))}
        </View>

        {icons.map((item) => (
          <NavIcon key={item.label} href={item.href} icon={item.icon} label={item.label} />
        ))}
        <View className="pl-1">
          <Avatar
            name={name}
            size={34}
            onPress={() => router.push(profileHref)}
            label="Your profile"
          />
        </View>
      </View>
    </View>
  );
}
