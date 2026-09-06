import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';
import { colors, radius, shadow, HIT_TARGET_MIN } from '@mwalimu/ui';

/**
 * expo-router 57 vendors react-navigation rather than depending on it, so
 * `@react-navigation/bottom-tabs` is not a resolvable package here. Deriving
 * the props from the `tabBar` slot itself is better than reaching into
 * `expo-router/build/...`: it is the public surface, and it stays correct if
 * the vendored layout moves.
 */
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

/**
 * A tab bar that floats over the content instead of sitting welded to the
 * bottom edge.
 *
 * This is the one structural idea worth taking from the Liquid Glass brief.
 * The rest of that language — refraction, specular highlights, adaptive frost —
 * is live blur, which is the single most expensive thing to composite on the
 * mid-range Android hardware this app is actually for, and which `expo-blur`
 * only approximates there anyway. So the plate stays opaque `card` white: the
 * lift comes from a real shadow and the gap around it, not from translucency.
 */
export const TAB_BAR_HEIGHT = 58;

/** Gap between the plate and the screen edges, and its minimum bottom offset. */
export const TAB_BAR_EDGE_GAP = 10;
const EDGE_GAP = TAB_BAR_EDGE_GAP;

/**
 * Bottom padding a scrolling tab screen must leave so the floating plate never
 * covers its last row. Exported as a hook rather than a constant because it
 * depends on the safe-area inset — a hardcoded number is right on exactly one
 * device.
 */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + Math.max(insets.bottom, EDGE_GAP) + EDGE_GAP + 12;
}

export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    // box-none so the gap around the plate stays scrollable rather than
    // swallowing touches meant for the content underneath.
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: EDGE_GAP,
        paddingBottom: Math.max(insets.bottom, EDGE_GAP),
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: TAB_BAR_HEIGHT,
          paddingHorizontal: 5,
          backgroundColor: colors.card,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.border,
          ...shadow.floating,
        }}
      >
        {state.routes.map((route, index) => {
          const descriptor = descriptors[route.key];
          if (descriptor === undefined) return null;

          const { options } = descriptor;
          const focused = state.index === index;
          const label = options.title ?? route.name;
          // The accent is already spent on the primary action, so an active tab
          // is ink on a wash pill, never a coloured fill.
          const tint = focused ? colors.foreground : colors.mutedForeground;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={{
                flex: 1,
                minHeight: HIT_TARGET_MIN,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                borderRadius: radius.pill,
                backgroundColor: focused ? colors.wash : 'transparent',
              }}
            >
              {options.tabBarIcon?.({ focused, color: tint, size: 19 })}
              <Text
                numberOfLines={1}
                style={{
                  fontFamily: 'InterTight_500Medium',
                  fontSize: 10.5,
                  fontWeight: '500',
                  color: tint,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
