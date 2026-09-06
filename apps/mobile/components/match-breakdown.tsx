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
  if (status === 'met') return { mark: '✓', bg: 'bg-successBg', fg: 'text-success' } as const;
  if (status === 'partial') return { mark: '!', bg: 'bg-warningBg', fg: 'text-warning' } as const;
  return mustHave
    ? ({ mark: '✕', bg: 'bg-dangerBg', fg: 'text-danger' } as const)
    : ({ mark: '!', bg: 'bg-warningBg', fg: 'text-warning' } as const);
}

const RING = { strong: 'text-success', good: 'text-primary', partial: 'text-warning', weak: 'text-muted' } as const;

export function MatchBreakdown({ match }: { match: MatchResult }) {
  const band = matchBand(match.score);

  return (
    <Card className="p-3.5">
      <View className="flex-row items-center gap-3.5">
        <View className="h-16 w-16 items-center justify-center rounded-full border-[6px] border-mutedBg">
          <Text className={`text-[17px] font-extrabold tracking-tight ${RING[band]}`}>
            {match.score}%
          </Text>
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-[13.5px] font-bold text-foreground">
            {match.blocked ? 'Not eligible' : MATCH_BAND_LABEL[band]}
          </Text>
          <Text className="mt-0.5 text-[11.5px] leading-4 text-muted">{explainMatch(match)}</Text>
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
              <View className={`h-[22px] w-[22px] items-center justify-center rounded-full ${tone.bg}`}>
                <Text className={`text-[11px] font-bold ${tone.fg}`}>{tone.mark}</Text>
              </View>
              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-[12.5px] font-semibold text-foreground">{req.label}</Text>
                  {req.mustHave ? (
                    <Text className="text-[10px] font-bold uppercase tracking-wide text-danger">
                      required
                    </Text>
                  ) : null}
                </View>
                <Text className="text-[11px] text-muted">{req.detail}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
