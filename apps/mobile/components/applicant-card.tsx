import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { formatLabel, formatPostedAge, matchBand } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import type { Tables } from '@mwalimu/types';
import { Avatar, Card, Chip, Tag, tabularNums } from './ui';
import type { Applicant } from '../lib/recruiter';

type Stage = Tables<'applications'>['stage'];

/**
 * One person who answered a listing, and what you can do about them.
 *
 * Lifted out of the recruiter screen when parents needed the same thing. A
 * school triaging twenty applicants and a parent looking at three tutors are
 * the same act — read the profile, move them along, say something — and two
 * copies of this card would have drifted the moment either side changed.
 */
const STAGES: readonly Stage[] = ['applied', 'viewed', 'shortlisted', 'interview', 'offered', 'rejected'];

const STAGE_TONE: Readonly<Record<string, string>> = {
  applied: 'text-mutedForeground',
  viewed: 'text-infoForeground',
  shortlisted: 'text-successForeground',
  interview: 'text-successForeground',
  offered: 'text-successForeground',
  rejected: 'text-mutedForeground',
};

/**
 * A school receives applications; a parent receives answers. Same pipeline,
 * different word — and "Applied" under a heading that reads "Who answered"
 * is the kind of seam that makes an app feel assembled rather than written.
 */
export function ApplicantCard({ item, onStage, onMessage, now, verb = 'applied' }: {
  item: Applicant;
  onStage: (stage: Stage) => void;
  onMessage: () => void;
  now: Date;
  verb?: 'applied' | 'answered';
}) {
  const [open, setOpen] = useState(false);
  const live = item.liveMatch;
  const frozen = item.application.match_score;
  const teacher = item.teacher;

  return (
    <Card className="gap-2.5 p-3.5">
      <View className="flex-row items-center gap-2.5">
        <Avatar name={teacher?.fullName ?? '?'} size={36} />
        <View className="min-w-0 flex-1">
          <Text className="text-[13px] font-medium text-foreground">
            {teacher?.fullName ?? 'Profile unavailable'}
          </Text>
          <Text className="text-[11.5px] text-mutedForeground">
            {teacher === null
              ? 'This teacher’s profile could not be read'
              : [teacher.headline, `${teacher.experienceYears} yrs`].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {live === null ? null : (
          <View className="items-end">
            <Text
              style={tabularNums}
              className={`text-[17px] font-medium tracking-tight ${
                matchBand(live.score) === 'strong' ? 'text-successForeground' : 'text-foreground'
              }`}
            >
              {live.score}%
            </Text>
            <Text className="text-[10px] uppercase tracking-wider text-mutedForeground">match</Text>
          </View>
        )}
      </View>

      {/*
        The stored score is what the client asserted at submission and can be
        forged; the live one is recomputed here by the same matcher. When they
        disagree it is worth saying so rather than quietly showing one.
      */}
      {live !== null && Math.abs(live.score - frozen) > 2 ? (
        <Text className="text-[11px] text-mutedForeground">
          Scored {frozen}% when they applied — {live.score}% against their profile today.
        </Text>
      ) : null}

      {teacher === null ? null : (
        <View className="flex-row flex-wrap gap-1.5">
          {teacher.subjects.slice(0, 4).map((s) => <Tag key={s} label={formatLabel(s)} />)}
          {teacher.tscNumber === undefined
            ? <Tag label="No TSC number" />
            : <Tag label={teacher.tscVerified ? 'TSC verified' : 'TSC given'} />}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center gap-1.5"
      >
        <Text className={`text-[11.5px] font-medium ${STAGE_TONE[item.application.stage] ?? ''}`}>
          {item.application.stage === 'applied' && verb === 'answered'
            ? 'Answered'
            : formatLabel(item.application.stage)}
        </Text>
        <Text className="text-[11px] text-mutedForeground">
          {` · ${verb} `}{formatPostedAge(new Date(item.application.created_at), now)}
        </Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={13} color={colors.mutedForeground} />
      </Pressable>

      {/*
        Talking to them is never behind a tap. It was inside the collapsed
        block with the stage chips, which is defensible for a school triaging
        twenty applicants and wrong for a parent looking at two tutors — there,
        messaging is not one option among several, it is the whole point.
        The pipeline stays collapsed, because that genuinely is triage.
      */}
      <Pressable
        accessibilityRole="button"
        onPress={onMessage}
        className="flex-row items-center gap-1.5"
      >
        <Feather name="mail" size={13} color={colors.primary} />
        <Text className="text-[12px] font-medium text-primary">
          Message {item.teacher?.fullName.split(' ')[0] ?? 'this teacher'}
        </Text>
      </Pressable>

      {open ? (
        <View className="flex-row flex-wrap gap-1.5">
          {STAGES.map((s) => (
            <Chip
              key={s}
              label={formatLabel(s)}
              selected={item.application.stage === s}
              onPress={() => onStage(s)}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}


export { STAGES, STAGE_TONE };
