import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import type { CvReadiness, CvStep, CvStepId } from '@mwalimu/core';
import { colors, radius } from '@mwalimu/ui';
import { Card, StatusBadge } from './ui';

/**
 * The top of the CV screen: where this CV stands, and the one thing to do next.
 *
 * The editor used to open on a notice about where your name comes from,
 * followed by nine identical folds. Nothing said what the document was for,
 * whether it was any good yet, or which part a school actually reads — so
 * filling it in felt like paperwork rather than like getting closer to a job.
 *
 * This card answers all three, in the order a person asks them: how far along
 * am I, what is this for, and what do I do now. Every row is a way into the
 * section that fixes it, because a checklist you cannot act on from where you
 * are reading it is just a list of complaints.
 */

/** How many outstanding items to name before the list becomes wallpaper. */
const SHOWN = 3;

function headline(readiness: CvReadiness): string {
  if (readiness.percent === 0) return 'Start your CV';
  if (!readiness.ready) return 'Your CV so far';
  return readiness.missing.length === 0 ? 'Your CV is complete' : 'Your CV is ready to send';
}

/** One outstanding item: what to add, why it earns its place, and a way in. */
function StepRow({
  step, onPress,
}: {
  readonly step: CvStep;
  readonly onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${step.action}. ${step.why}`}
      onPress={onPress}
      style={{ borderRadius: radius.lg }}
      className="min-h-[44px] flex-row items-center gap-3 bg-wash px-3 py-2.5"
    >
      <View className="min-w-0 flex-1">
        <Text className="text-[12.5px] font-medium text-foreground">{step.action}</Text>
        <Text className="mt-0.5 text-[11px] leading-4 text-mutedForeground">{step.why}</Text>
      </View>
      {step.essential ? null : (
        <Text className="text-[10.5px] text-mutedForeground">Optional</Text>
      )}
      <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
    </Pressable>
  );
}

export function CvReadinessCard({
  readiness, onOpenStep, onPreview,
}: {
  readonly readiness: CvReadiness;
  readonly onOpenStep: (id: CvStepId) => void;
  readonly onPreview: () => void;
}) {
  const shown = readiness.missing.slice(0, SHOWN);
  const rest = readiness.missing.length - shown.length;

  return (
    <Card className="gap-3.5 p-4">
      <View className="flex-row items-start gap-3.5">
        <View className="min-w-0 flex-1">
          <Text className="text-[15px] font-medium tracking-tight text-foreground">
            {headline(readiness)}
          </Text>
          <Text className="mt-1 text-[12px] leading-[18px] text-mutedForeground">
            {readiness.summary}
          </Text>
        </View>

        <View className="items-end">
          <Text className="text-[22px] font-medium tracking-tight text-foreground">
            {`${readiness.percent}%`}
          </Text>
          <Text className="text-[10.5px] text-mutedForeground">complete</Text>
        </View>
      </View>

      {/*
        A bar rather than the dashboard's ring. A ring says where you are in a
        sequence — stage three of five — and this is a proportion of a
        document, which a bar states more plainly at a glance.
      */}
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: readiness.percent }}
        accessibilityLabel={`CV ${readiness.percent} per cent complete`}
        style={{ height: 6, borderRadius: 999 }}
        className="w-full overflow-hidden bg-secondary"
      >
        <View
          style={{ width: `${Math.max(readiness.percent, 2)}%`, height: 6, borderRadius: 999 }}
          className={readiness.ready ? 'bg-success' : 'bg-primary'}
        />
      </View>

      {/*
        What this document is for, said once, at the top. Everything below it
        is a form; without this line the form is the only thing on the screen.
      */}
      <Text className="text-[11.5px] leading-4 text-mutedForeground">
        Every application you send carries this CV, and a school reads it before deciding
        whether to call. You can download it as a PDF or a Word file at any point.
      </Text>

      {shown.length === 0 ? null : (
        <View className="gap-1.5">
          <View className="flex-row items-center gap-2">
            <Text className="text-[11.5px] font-medium text-foreground">What is left</Text>
            {readiness.essentialsLeft === 0 ? null : (
              <StatusBadge
                label={readiness.essentialsLeft === 1 ? '1 essential' : `${readiness.essentialsLeft} essentials`}
                tone="warning"
              />
            )}
          </View>
          {shown.map((step) => (
            <StepRow key={step.id} step={step} onPress={() => onOpenStep(step.id)} />
          ))}
          {rest <= 0 ? null : (
            <Text className="px-1 text-[10.5px] text-mutedForeground">
              {rest === 1 ? 'One more optional section below.' : `${rest} more optional sections below.`}
            </Text>
          )}
        </View>
      )}

      {/*
        Preview sits here as well as at the foot of the form. Seeing the
        document is what tells a teacher their CV is real, and asking them to
        scroll past nine folds to find out is how it stays unseen.
      */}
      <Pressable
        accessibilityRole="button"
        onPress={onPreview}
        style={{ minHeight: 44, borderRadius: radius.pill }}
        className={`flex-row items-center justify-center gap-2 px-4 ${
          readiness.ready ? 'bg-primary' : 'border border-border bg-card'
        }`}
      >
        <Feather
          name="file-text"
          size={15}
          color={readiness.ready ? colors.primaryForeground : colors.foreground}
        />
        <Text
          className={`text-[13px] font-medium ${
            readiness.ready ? 'text-primaryForeground' : 'text-foreground'
          }`}
        >
          Preview and download
        </Text>
      </Pressable>
    </Card>
  );
}
