import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { colors } from '@mwalimu/ui';
import { amIAdmin } from '../lib/admin';

/**
 * Staff-only screens.
 *
 * RLS already refuses the writes, so this is not the security boundary — the
 * database is. It is there because a route reached directly showed a teacher a
 * moderation queue that was empty for no visible reason, and a composer whose
 * Publish button would have failed with a policy error. Being told plainly is
 * better than either.
 *
 * Deliberately not a router guard: `Stack.Protected` keys off auth status,
 * which every signed-in teacher shares, and adding staff to it would mean the
 * whole app waits on an extra round trip at launch to answer a question only
 * two screens ask.
 */
export function AdminOnly({ children }: { children: ReactNode }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void amIAdmin().then((yes) => { if (!cancelled) setAllowed(yes); });
    return () => { cancelled = true; };
  }, []);

  if (allowed === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.mutedForeground} />
      </View>
    );
  }

  if (!allowed) {
    return (
      <View className="flex-1 items-center justify-center gap-2 bg-background px-8">
        <Text className="text-[15px] font-medium text-foreground">Not your desk</Text>
        <Text className="text-center text-[12.5px] leading-5 text-mutedForeground">
          This screen is for the people who moderate reviews and verify schools.
        </Text>
      </View>
    );
  }

  return <>{children}</>;
}
