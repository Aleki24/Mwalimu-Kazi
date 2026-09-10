import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@mwalimu/ui';

/**
 * A list of short lines a teacher adds one at a time.
 *
 * Skills, languages, hobbies, positions of responsibility: four sections that
 * are the same act — type a thing, press add, see it in a list, remove the one
 * you got wrong. Four copies of that would have drifted the moment any of them
 * gained a validation rule.
 *
 * It holds no draft of its own beyond the input, and reports the whole list on
 * every change: the screen owns the value, so a save button knows what it is
 * saving without reaching in here for it.
 */
export function ListEditor({
  label, items, onChange, placeholder, max = 20, maxLength = 300,
}: {
  label: string;
  items: readonly string[];
  onChange: (next: readonly string[]) => void;
  placeholder?: string;
  max?: number;
  maxLength?: number;
}) {
  const [draft, setDraft] = useState('');
  const value = draft.trim();
  // A duplicate is almost always a double tap, and a CV listing "Leadership"
  // twice reads as carelessness by the person who wrote it.
  const already = items.some((i) => i.toLowerCase() === value.toLowerCase());
  const canAdd = value !== '' && !already && items.length < max;

  const add = () => {
    if (!canAdd) return;
    onChange([...items, value]);
    setDraft('');
  };

  return (
    <View className="gap-2">
      <Text className="text-[11.5px] font-medium text-mutedForeground">{label}</Text>

      {items.map((item, index) => (
        <View
          key={`${item}-${index}`}
          className="flex-row items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
        >
          <Text className="min-w-0 flex-1 text-[13px] text-foreground">{item}</Text>
          <Pressable
            accessibilityRole="button"
            // Named with its list: four editors on one screen, and "Remove
            // Chess" alone does not say which one it belongs to — to a screen
            // reader or to anything else driving the page.
            accessibilityLabel={`Remove ${item} from ${label}`}
            hitSlop={8}
            onPress={() => onChange(items.filter((_, i) => i !== index))}
          >
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ))}

      {items.length >= max ? (
        <Text className="text-[10.5px] text-mutedForeground">
          That is as many as a reader will take in. Remove one to add another.
        </Text>
      ) : (
        <View className="flex-row gap-2">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            placeholderTextColor={colors.mutedForeground}
            maxLength={maxLength}
            onSubmitEditing={add}
            returnKeyType="done"
            className="h-11 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-[14px] text-foreground"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add to ${label}`}
            disabled={!canAdd}
            onPress={add}
            className={`h-11 w-11 items-center justify-center rounded-md ${
              canAdd ? 'bg-primary' : 'border border-border bg-card'
            }`}
          >
            <Feather
              name="plus"
              size={16}
              color={canAdd ? colors.primaryForeground : colors.disabledForeground}
            />
          </Pressable>
        </View>
      )}

      {already && value !== '' ? (
        <Text className="text-[10.5px] text-mutedForeground">
          {value} is already on the list.
        </Text>
      ) : null}
    </View>
  );
}
