import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  INTERVIEW_PLACES, REJECTION_REASONS, REJECTION_REASONS_TUITION,
  formatInterviewWhen, nairobiIso,
} from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { Button } from './ui';
import type { Decision } from '../lib/recruiter';

/**
 * What you say when you turn somebody down, or ask them in.
 *
 * These are the two moments in the pipeline where the stage on its own is
 * useless. "Interview" without a time is not an invitation, and "Rejected"
 * with nothing attached is the silence every teacher on every Kenyan jobs
 * board already knows. Everything else — viewed, shortlisted, offered — says
 * enough by itself and goes straight through.
 *
 * Inline in the card rather than a modal. A recruiter working down twenty
 * applicants is comparing as they go, and a sheet that covers the list takes
 * away the thing they were reading.
 */
export function DecisionSheet({
  stage, teacherName, busy, onCancel, onConfirm, verb = 'applied',
}: {
  stage: 'interview' | 'rejected';
  teacherName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (decision: Decision) => void;
  /** 'answered' is a household looking at tutors; it changes the words offered. */
  verb?: 'applied' | 'answered';
}) {
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [place, setPlace] = useState('');

  const first = teacherName.split(' ')[0] ?? 'them';
  const when = nairobiIso(date, time);
  /*
    A time or a note, not both. Plenty of first rounds are "we will ring you on
    Monday to fix a time", and refusing that would push a school into inventing
    a slot it does not have. The same rule is a check constraint on the row, so
    a client that forgot it is refused rather than storing an invitation with
    nothing in it.
  */
  const ready = stage === 'rejected' || when !== null || note.trim().length >= 4;

  const send = () => {
    if (stage === 'rejected') {
      onConfirm({ note });
      return;
    }
    onConfirm({
      note,
      ...(when === null ? {} : { interviewAt: when }),
      interviewPlace: place,
    });
  };

  return (
    <View className="gap-2.5 rounded-md border border-border bg-secondary p-3">
      <Text className="text-[12.5px] font-medium text-foreground">
        {stage === 'rejected' ? `Tell ${first} why` : `Ask ${first} in`}
      </Text>

      {stage === 'interview' ? (
        <>
          <View className="flex-row flex-wrap gap-2">
            <Field label="Date" placeholder="2026-10-06" value={date} onChangeText={setDate} />
            <Field label="Time" placeholder="09:30" value={time} onChangeText={setTime} />
          </View>
          {/*
            Read it back in words. `2026-10-06` and `09:30` are easy to type and
            easy to get wrong by a month, and the sentence underneath is what
            catches that before it reaches somebody's notifications.
          */}
          <Text className="text-[11px] leading-4 text-mutedForeground">
            {when === null
              ? 'A date as 2026-10-06 and a time as 09:30, or leave both out and say below when you will be in touch.'
              : `They will be told: ${formatInterviewWhen(when)}. Kenyan time.`}
          </Text>

          <View className="flex-row flex-wrap gap-1.5">
            {INTERVIEW_PLACES.map((p) => (
              <Suggestion key={p} label={p} onPress={() => setPlace(p)} />
            ))}
          </View>
          <TextInput
            value={place}
            onChangeText={setPlace}
            placeholder="Where — the staff room, the Ngong Road gate…"
            placeholderTextColor={colors.mutedForeground}
            maxLength={120}
            className="h-11 rounded-md border border-border bg-card px-3 text-[13px] text-foreground"
          />
        </>
      ) : (
        <View className="flex-row flex-wrap gap-1.5">
          {(verb === 'answered' ? REJECTION_REASONS_TUITION : REJECTION_REASONS).map((r) => (
            <Suggestion key={r} label={r} onPress={() => setNote(r)} />
          ))}
        </View>
      )}

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder={stage === 'rejected'
          ? 'Or say it in your own words'
          : 'Anything else they should bring or know'}
        placeholderTextColor={colors.mutedForeground}
        multiline
        maxLength={600}
        className="min-h-[64px] rounded-md border border-border bg-card px-3 py-2 text-[13px] text-foreground"
      />

      <View className="flex-row flex-wrap gap-2">
        <Button
          label={stage === 'rejected'
            // Saying so is the point. A school that sends nothing should have
            // to read that that is what it is doing.
            ? (note.trim() === '' ? 'Send with no reason' : `Tell ${first}`)
            : `Invite ${first}`}
          onPress={send}
          disabled={busy || !ready}
        />
        <Button label="Cancel" variant="quiet" onPress={onCancel} disabled={busy} />
      </View>
    </View>
  );
}

function Field({ label, placeholder, value, onChangeText }: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (next: string) => void;
}) {
  return (
    <View className="min-w-[140px] flex-1 gap-1">
      <Text className="text-[11px] text-mutedForeground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        autoCapitalize="none"
        autoCorrect={false}
        className="h-11 rounded-md border border-border bg-card px-3 text-[13px] text-foreground"
      />
    </View>
  );
}

/**
 * A phrase you can tap into the field rather than a choice you are locked to.
 * Not a Chip: nothing here is selected state — pressing one writes it into the
 * box below, where it can then be edited, which is the whole point of offering
 * words to somebody who is about to disappoint a stranger.
 */
function Suggestion({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{ minHeight: 34 }}
      className="justify-center rounded-md border border-border bg-card px-2.5"
    >
      <Text className="text-[11.5px] text-mutedForeground">{label}</Text>
    </Pressable>
  );
}
