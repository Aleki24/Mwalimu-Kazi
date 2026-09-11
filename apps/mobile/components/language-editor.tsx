import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@mwalimu/ui';
import type { Tables } from '@mwalimu/types';

type LanguageRow = Tables<'cv_languages'>;

/**
 * Languages, and how well.
 *
 * Several of the templates draw five dots beside each language, so this is
 * where the dots come from. A language starts with none filled and stays that
 * way unless the teacher taps: an app that quietly assumed "fluent" would be
 * putting a claim on a CV that its owner never made.
 *
 * Tapping the dot you are already on clears the level again, which is the only
 * way back to "I would rather not say" once you have said something.
 */
export function LanguageEditor({
  items, onAdd, onLevel, onRemove,
}: {
  items: readonly LanguageRow[];
  onAdd: (name: string) => void;
  onLevel: (row: LanguageRow, level: number | null) => void;
  onRemove: (row: LanguageRow) => void;
}) {
  const [draft, setDraft] = useState('');
  const value = draft.trim();
  const already = items.some((i) => i.name.toLowerCase() === value.toLowerCase());
  const canAdd = value.length >= 2 && !already && items.length < 12;
  const why = value === '' ? 'Write a language first, then press +.'
    : value.length < 2 ? null
    : already ? `${value} is already on the list.`
    : null;

  const add = () => {
    if (!canAdd) return;
    onAdd(value);
    setDraft('');
  };

  return (
    <View className="gap-2">
      <Text className="text-[11.5px] font-medium text-mutedForeground">Languages</Text>

      {items.map((row) => (
        <View
          key={row.id}
          className="flex-row items-center gap-2 rounded-md border border-border bg-card px-3 py-2"
        >
          <Text className="min-w-0 flex-1 text-[13px] text-foreground">{row.name}</Text>
          <View className="flex-row gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                accessibilityRole="button"
                accessibilityLabel={`${row.name}: ${n} out of 5`}
                accessibilityState={{ selected: (row.level ?? 0) >= n }}
                hitSlop={6}
                onPress={() => onLevel(row, row.level === n ? null : n)}
              >
                <View
                  className={`h-3.5 w-3.5 rounded-full ${
                    (row.level ?? 0) >= n ? 'bg-primary' : 'bg-wash'
                  }`}
                />
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${row.name} from Languages`}
            hitSlop={8}
            onPress={() => onRemove(row)}
          >
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </Pressable>
        </View>
      ))}

      <View className="flex-row gap-2">
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Kiswahili"
          placeholderTextColor={colors.mutedForeground}
          maxLength={60}
          onSubmitEditing={add}
          returnKeyType="done"
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-[14px] text-foreground"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add to Languages"
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

      {why === null ? null : (
        <Text className="text-[10.5px] text-mutedForeground">{why}</Text>
      )}
      {items.length === 0 ? null : (
        <Text className="text-[10.5px] leading-4 text-mutedForeground">
          Tap the dots to say how well. Leave them empty to say nothing.
        </Text>
      )}
    </View>
  );
}
