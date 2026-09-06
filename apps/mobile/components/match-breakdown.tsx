import { Text, View } from 'react-native';
import {
  explainMatch, MATCH_BAND_LABEL, matchBand,
  type MatchResult, type RequirementStatus,
} from '@mwalimu/core';
import { Card } from './ui';

/**
 * The requirement rows behind a match score.
 *
 * Severity is NOT the same as status: an unmet requirement the school marked
 * must-have is a red blocker, while an unmet nice-to-have is amber. Colour
 * therefore comes from both fields, never from status alone.
 */
function severity(status: RequirementStatus, mustHave: boolean) {
  // The glyph carries the colour; the disc behind it stays neutral ink wash.
  // A filled green or red circle per row turned the card into a traffic light.
  if (status === 'met') return { mark: '✓', fg: 'text-successForeground' } as const;
  if (status === 'partial') return { mark: '!', fg: 'text-warningForeground' } as const;
  return mustHave
    ? ({ mark: '✕', fg: 'text-destructiveForeground' } as const)
    : ({ mark: '!', fg: 'text-warningForeground' } as const);
}

const RING = {
  strong: 'text-successForeground',
  good: 'text-foreground',
  partial: 'text-warningForeground',
  weak: 'text-mutedForeground',
} as const;

export function MatchBreakdown({ match }: { match: MatchResult }) {
  const band = matchBand(match.score);

  return (
    <Card className="p-3.5">
      <View className="flex-row items-center gap-3.5">
        <View className="h-16 w-16 items-center justify-center rounded-full border-[6px] border-border">
          <Text className={`text-[17px] font-medium tracking-tight ${RING[band]}`}>
            {match.score}%
          </Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[13.5px] font-medium text-foreground">
            {match.blocked ? 'Not eligible' : MATCH_BAND_LABEL[band]}
          </Text>
          <Text className="mt-0.5 text-[11.5px] leading-4 text-mutedForeground">{explainMatch(match)}</Text>
        </View>
      </View>

      <View className="mt-2.5">
        {match.requirements.map((req, i) => {
          const tone = severity(req.status, req.mustHave);
          return (
            <View
              key={`${req.kind}-${i}`}
              className="flex-row items-center gap-2.5 border-b border-border py-2"
            >
              <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-wash">
                <Text className={`text-[11px] ${tone.fg}`}>{tone.mark}</Text>
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-[12.5px] font-medium text-foreground">{req.label}</Text>
                  {req.mustHave ? (
                    <Text className="text-[10px] font-medium uppercase tracking-wide text-destructiveForeground">
                      required
                    </Text>
                  ) : null}
                </View>
                <Text className="text-[11px] text-mutedForeground">{req.detail}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
