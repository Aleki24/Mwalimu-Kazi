import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { ENGAGEMENT_LABEL, formatPostedAge } from '@mwalimu/core';
import type { Tables } from '@mwalimu/types';
import { colors, radius } from '@mwalimu/ui';
import { Avatar, Card, centredContent, ErrorBanner } from '../../components/ui';
import { HeroCard, HeroAction } from '../../components/hero-card';
import { TopNav, useWideLayout, type NavDestination } from '../../components/web-nav';
import { useParent, useViewer } from '../../lib/auth';
import { fetchMyPostings } from '../../lib/recruiter';
import { fetchThreads } from '../../lib/messages';

/**
 * Everything a parent came here to do, on one screen.
 *
 * A parent is not a daily user and should not be given a daily user's
 * furniture. A teacher gets five tabs because they come back to browse; a
 * parent arrives with one errand — find somebody to teach my child — does it,
 * and comes back when a teacher has answered. So this is a hub, not a
 * dashboard, and there is no tab bar underneath it to suggest four other
 * places they ought to be looking.
 *
 * The two ways to reach a tutor are both here because they suit different
 * people: some would rather look through teachers themselves, and some would
 * rather say what they need and let teachers come to them.
 */

interface Summary {
  readonly requests: readonly Tables<'jobs'>[];
  readonly unreadThreads: number;
}

const EMPTY: Summary = { requests: [], unreadThreads: 0 };

/** A parent's whole product, as the web build's top bar lists it. */
const DESTINATIONS = [
  { href: '/parent', label: 'Home', icon: 'home' },
  { href: '/tutors', label: 'Find a tutor', icon: 'search' },
  { href: '/requests', label: 'Your requests', icon: 'inbox' },
] as const satisfies readonly NavDestination[];

const ICONS = [
  { href: '/messages', label: 'Messages', icon: 'mail' },
  { href: '/notifications', label: 'Alerts', icon: 'bell' },
] as const satisfies readonly NavDestination[];

export default function ParentHomeScreen() {
  const parent = useParent();
  const viewer = useViewer();
  const wide = useWideLayout();
  const insets = useSafeAreaInsets();

  const [summary, setSummary] = useState<Summary>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [requests, threads] = await Promise.all([
        fetchMyPostings(viewer.id),
        fetchThreads(viewer.id),
      ]);
      setSummary({
        requests,
        unreadThreads: threads.filter((t) => t.unread > 0).length,
      });
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [viewer.id]);

  useEffect(() => { void load(); }, [load]);

  const open = summary.requests.filter((r) => r.published);
  const latest = open[0];

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: wide ? 0 : insets.top }}>
      {wide ? (
        <TopNav
          destinations={DESTINATIONS}
          icons={ICONS}
          name={parent.fullName}
          profileHref="/parent/profile"
        />
      ) : null}

      {/*
        Capped to the page on a wide window. Left full-bleed, the greeting sat
        against the left edge of a 1440px window while the cards it belongs to
        were centred six hundred points away.
      */}
      <View
        style={centredContent}
        className="w-full flex-row items-center gap-1 px-5 pb-4 pt-3"
      >
        <View className="min-w-0 flex-1">
          <Text numberOfLines={1} className="text-2xl font-medium tracking-tight text-foreground">
            {`Hi, ${parent.fullName.split(' ')[0] ?? parent.fullName}`}
          </Text>
          <Text className="mt-1 text-sm text-mutedForeground">Find a teacher for your child</Text>
        </View>

        {/* The bar above already carries these on a wide window. */}
        {wide ? null : (
          <>
            <HeaderIcon href="/messages" icon="mail" label="Messages" badge={summary.unreadThreads} />
            <HeaderIcon href="/notifications" icon="bell" label="Alerts" badge={0} />
            <View className="pl-1.5">
              <Avatar
                name={parent.fullName}
                size={40}
                onPress={() => router.push('/parent/profile')}
                label="Your details"
              />
            </View>
          </>
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 32, ...centredContent }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); void load(); }}
            tintColor={colors.mutedForeground}
          />
        }
      >
        {error !== null ? <ErrorBanner message={error} /> : null}

        {/*
          The hero is whichever is true: a request with teachers already
          answering, or, before there is one, the invitation to look.
        */}
        {latest === undefined ? (
          <HeroCard
            eyebrow="Start here"
            title="Find a tutor"
            meta="Browse teachers who tutor near you, and message the ones you like"
            footer={<HeroAction label="Browse tutors" />}
            onPress={() => router.push('/tutors')}
          />
        ) : (
          <HeroCard
            eyebrow={ENGAGEMENT_LABEL[latest.engagement]}
            title={latest.title}
            meta={`Posted ${formatPostedAge(new Date(latest.posted_at), new Date())} · see who answered`}
            footer={<HeroAction label="See the answers" />}
            onPress={() => router.push('/requests')}
          />
        )}

        <Action
          href="/tutors"
          icon="search"
          title="Find a tutor"
          body="Look through teachers who tutor, by subject and by where they can teach."
        />
        <Action
          href="/post/new"
          icon="edit-3"
          title="Ask for what you need"
          body="Say the subject, the level and when — teachers who match answer you."
        />
        <Action
          href="/requests"
          icon="inbox"
          title="Your requests"
          body={loading
            ? 'Loading…'
            : open.length === 0
              ? 'Nothing posted yet.'
              : `${open.length} open · the teachers who answered are here`}
        />
        <Action
          href="/messages"
          icon="message-square"
          title="Messages"
          body={summary.unreadThreads === 0
            ? 'Your conversations with teachers.'
            : `${summary.unreadThreads} with something new`}
        />

        {loading ? <ActivityIndicator color={colors.mutedForeground} className="py-4" /> : null}

        <Text className="px-1 pt-2 text-[11.5px] leading-4 text-mutedForeground">
          Teachers only see what you put in a request. Your phone number and the address where
          you want lessons stay yours until you give them to somebody yourself.
        </Text>
      </ScrollView>
    </View>
  );
}

/** One of the four things a parent is here to do. */
function Action({
  href, icon, title, body,
}: {
  readonly href: React.ComponentProps<typeof Link>['href'];
  readonly icon: React.ComponentProps<typeof Feather>['name'];
  readonly title: string;
  readonly body: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={title}>
        <Card className="flex-row items-center gap-3.5 p-4">
          <View
            style={{ borderRadius: radius.xl2 }}
            className="h-11 w-11 items-center justify-center bg-primarySurface"
          >
            <Feather name={icon} size={18} color={colors.primary} />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="text-[14.5px] font-medium tracking-tight text-foreground">{title}</Text>
            <Text numberOfLines={2} className="mt-0.5 text-[12px] leading-[17px] text-mutedForeground">
              {body}
            </Text>
          </View>
          <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
        </Card>
      </Pressable>
    </Link>
  );
}

/** A quiet round icon button in the header, with a count when there is one. */
function HeaderIcon({
  href, icon, label, badge,
}: {
  readonly href: React.ComponentProps<typeof Link>['href'];
  readonly icon: React.ComponentProps<typeof Feather>['name'];
  readonly label: string;
  readonly badge: number;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={badge > 0 ? `${label}, ${badge} new` : label}
        hitSlop={8}
        className="h-10 w-10 items-center justify-center"
      >
        <Feather name={icon} size={19} color={colors.mutedForeground} />
        {badge > 0 ? (
          <View
            style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 999 }}
            className="bg-urgent"
          />
        ) : null}
      </Pressable>
    </Link>
  );
}
