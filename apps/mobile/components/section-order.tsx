import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS, useAnimatedStyle, useSharedValue, withTiming,
} from 'react-native-reanimated';
import Feather from '@expo/vector-icons/Feather';
import { CV_SECTIONS, type CvSection, type CvSectionKey } from '@mwalimu/core';
import { colors, radius } from '@mwalimu/ui';

/**
 * The sections of the CV, in the order they will print, with the words the
 * teacher wants over them.
 *
 * Drag the handle to move one; tap the title to rename it. Both are here
 * rather than on the sections of the form itself because the rows have to be
 * the same height for a drag to know what it is passing over, and a form
 * section is as tall as whatever is inside it.
 *
 * The reorder is a swap rather than a full re-layout: each row is `ROW` tall,
 * so the index under the finger is the row's own index plus the distance
 * dragged divided by the row height. That is the whole algorithm, and it is
 * why every row has to be a fixed height.
 */

const ROW = 52;

function clamp(n: number, low: number, high: number): number {
  return Math.min(Math.max(n, low), high);
}

/** Move one item, leaving the rest in order. */
export function moveItem<T>(items: readonly T[], from: number, to: number): readonly T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return items;
  next.splice(clamp(to, 0, next.length), 0, moved);
  return next;
}

function Row({
  section, index, count, onMove, onRename, dragging, setDragging,
}: {
  section: CvSection;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRename: (key: CvSectionKey, title: string | null) => void;
  dragging: number | null;
  setDragging: (i: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.title);
  const offset = useSharedValue(0);
  const active = useSharedValue(false);

  const pan = Gesture.Pan()
    .activateAfterLongPress(120)
    .onStart(() => {
      active.value = true;
      runOnJS(setDragging)(index);
    })
    .onUpdate((e) => { offset.value = e.translationY; })
    .onEnd((e) => {
      const moved = Math.round(e.translationY / ROW);
      offset.value = withTiming(0, { duration: 120 });
      active.value = false;
      if (moved !== 0) runOnJS(onMove)(index, index + moved);
      runOnJS(setDragging)(null);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
    zIndex: active.value ? 10 : 0,
    opacity: active.value ? 0.94 : 1,
  }));

  const commit = () => {
    const value = draft.trim();
    setEditing(false);
    // Back to the default word rather than an empty heading: a section with no
    // name is a mistake, not a choice.
    onRename(section.key, value === '' || value === CV_SECTIONS[section.key] ? null : value);
    if (value === '') setDraft(CV_SECTIONS[section.key]);
  };

  return (
    <Animated.View style={[style, { height: ROW }]}>
      <View
        style={{ borderRadius: radius.md }}
        className={`h-[44px] flex-row items-center gap-2 border bg-card px-2.5 ${
          dragging === index ? 'border-primary' : 'border-border'
        }`}
      >
        <GestureDetector gesture={pan}>
          <View
            accessibilityRole="adjustable"
            accessibilityLabel={`Move ${section.title}`}
            accessibilityValue={{ text: `${index + 1} of ${count}` }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            // Arrows as well as the drag: a gesture is not reachable by
            // everyone, and "drag to reorder" with no alternative is a feature
            // some people simply cannot use.
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'increment') onMove(index, index + 1);
              if (e.nativeEvent.actionName === 'decrement') onMove(index, index - 1);
            }}
            className="h-11 w-8 items-center justify-center"
          >
            <Feather name="menu" size={15} color={colors.mutedForeground} />
          </View>
        </GestureDetector>

        {editing ? (
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={commit}
            onSubmitEditing={commit}
            autoFocus
            // Selected on focus, so tapping a name and typing replaces it.
            // Without this the caret lands at the end and the new name is
            // appended to the old one — "EmploymentWork Experience".
            selectTextOnFocus
            maxLength={40}
            returnKeyType="done"
            className="min-w-0 flex-1 text-[13px] font-medium text-foreground"
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Rename ${section.title}`}
            onPress={() => { setDraft(section.title); setEditing(true); }}
            className="h-11 min-w-0 flex-1 justify-center"
          >
            <Text className="text-[13px] font-medium text-foreground">{section.title}</Text>
          </Pressable>
        )}

        <View className="flex-row">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Move ${section.title} up`}
            disabled={index === 0}
            onPress={() => onMove(index, index - 1)}
            hitSlop={4}
            className="h-11 w-8 items-center justify-center"
          >
            <Feather
              name="chevron-up"
              size={15}
              color={index === 0 ? colors.disabledForeground : colors.mutedForeground}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Move ${section.title} down`}
            disabled={index === count - 1}
            onPress={() => onMove(index, index + 1)}
            hitSlop={4}
            className="h-11 w-8 items-center justify-center"
          >
            <Feather
              name="chevron-down"
              size={15}
              color={index === count - 1 ? colors.disabledForeground : colors.mutedForeground}
            />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

export function SectionOrder({
  sections, onReorder, onRename,
}: {
  sections: readonly CvSection[];
  onReorder: (next: readonly CvSection[]) => void;
  onRename: (key: CvSectionKey, title: string | null) => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);

  return (
    <View className="gap-2">
      <Text className="text-[11px] leading-4 text-mutedForeground">
        Drag a handle to move a section, or use the arrows. Tap a name to change it —
        “Employment” is what most Kenyan schools call it, but plenty ask for
        “Work Experience”.
      </Text>
      <View>
        {sections.map((section, index) => (
          <Row
            key={section.key}
            section={section}
            index={index}
            count={sections.length}
            dragging={dragging}
            setDragging={setDragging}
            onMove={(from, to) => {
              if (to < 0 || to >= sections.length || from === to) return;
              onReorder(moveItem(sections, from, to));
            }}
            onRename={onRename}
          />
        ))}
      </View>
    </View>
  );
}
