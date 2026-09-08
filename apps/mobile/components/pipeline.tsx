import { Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors, STATUS, type StatusTone } from '@mwalimu/ui';
import type { Tables } from '@mwalimu/types';

/**
 * The four things that can happen to an application, in the order they happen.
 *
 * Frozen as a tuple so the pipeline is a fact about the product rather than a
 * prop each screen re-declares. A fifth stage is a product decision; it should
 * not be possible to add one by passing a longer array.
 */
export const PIPELINE_STAGES = ['Applied', 'Shortlisted', 'Interview', 'Offer'] as const;

/** Height of the box each node sits in, sized for the largest dot. */
const NODE_BOX = 14;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** How far a row has travelled. `halted` is a rejection: it stops where it is. */
export interface PipelineProgress {
  /** Stages completed, 0…4. 2 means Applied and Shortlisted are behind you. */
  readonly reached: number;
  readonly halted?: boolean;
}

/**
 * A four-node horizontal pipeline: filled nodes behind you, hollow ahead.
 *
 * Colour carries the outcome and nothing else — indigo while it is live, coral
 * once it is halted — so a glance down a list of applications reads as a shape
 * before it reads as words.
 */
export function Pipeline({ reached, halted = false }: PipelineProgress) {
  const done = Math.min(Math.max(0, Math.round(reached)), PIPELINE_STAGES.length);
  const tone: StatusTone = halted ? 'danger' : 'primary';
  const { fill, text } = STATUS[tone];

  return (
    <View
      className="flex-row items-center"
      accessibilityRole="progressbar"
      accessibilityLabel={
        halted
          ? `Closed at ${PIPELINE_STAGES[Math.max(0, done - 1)]}`
          : `${PIPELINE_STAGES[Math.max(0, done - 1)]} — stage ${done} of ${PIPELINE_STAGES.length}`
      }
    >
      {PIPELINE_STAGES.map((stage, index) => {
        const complete = index < done;
        // The node you are actually sitting on, so it can read louder.
        const current = index === done - 1;

        return (
          <View key={stage} className="flex-1 items-center">
            <View className="w-full flex-row items-center">
              {/* Half-width rails either side keep every node's dot centred
                  under its label, including the first and last. */}
              <View
                className="h-[2px] flex-1"
                style={{ backgroundColor: index === 0 ? 'transparent' : complete ? fill : colors.secondary }}
              />
              {/*
                The dot sits in a fixed-height box so the current node can be
                larger without shoving its own label a few pixels lower than
                the others — a row of labels that does not share a baseline
                reads as a bug even when nobody can say why.
              */}
              <View style={{ height: NODE_BOX, alignItems: 'center', justifyContent: 'center' }}>
                <View
                  style={{
                    width: current ? 14 : 10,
                    height: current ? 14 : 10,
                    borderRadius: 999,
                    backgroundColor: complete ? fill : colors.card,
                    borderWidth: complete ? 0 : 1.5,
                    borderColor: colors.secondary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {current && !halted ? (
                    <Feather name="check" size={8} color={colors.primaryForeground} />
                  ) : null}
                </View>
              </View>
              <View
                className="h-[2px] flex-1"
                style={{
                  backgroundColor:
                    index === PIPELINE_STAGES.length - 1 ? 'transparent'
                    : index < done - 1 ? fill
                    : colors.secondary,
                }}
              />
            </View>

            <Text
              numberOfLines={1}
              style={{ color: complete ? text : colors.disabledForeground }}
              className={`mt-1.5 text-[10px] ${current ? 'font-medium' : ''}`}
            >
              {stage}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** The stage column as the database writes it. */
type ApplicationStage = Tables<'applications'>['stage'];

/**
 * Where a stored stage sits on the pipeline.
 *
 * This is the only place the database's eight stages are collapsed onto the
 * four the teacher sees, so a hero ring and a tracker row can never disagree
 * about how far an application has got.
 *
 * Two judgements are encoded here. `viewed` does not advance the pipeline —
 * a school opening your application is them looking at you, not them moving
 * you on, and showing it as progress would be flattery. And a rejection halts
 * wherever it lands: the row keeps the ground it covered rather than resetting
 * to zero, because "you were shortlisted and then turned down" is a different
 * fact from "nothing happened".
 */
export function pipelineProgress(stage: ApplicationStage): PipelineProgress {
  switch (stage) {
    case 'saved': return { reached: 0 };
    case 'applied': return { reached: 1 };
    case 'viewed': return { reached: 1 };
    case 'shortlisted': return { reached: 2 };
    case 'interview': return { reached: 3 };
    case 'offered': return { reached: 4 };
    case 'rejected': return { reached: 1, halted: true };
    case 'withdrawn': return { reached: 1, halted: true };
  }
}

/** The tone a status badge should take for the same stage. */
export function stageTone(stage: ApplicationStage): StatusTone {
  switch (stage) {
    case 'offered': return 'success';
    case 'interview': return 'success';
    case 'shortlisted': return 'warning';
    case 'viewed': return 'info';
    case 'rejected': return 'danger';
    case 'withdrawn': return 'danger';
    case 'applied': return 'neutral';
    case 'saved': return 'neutral';
  }
}
