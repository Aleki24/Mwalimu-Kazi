import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { formatLabel } from '@mwalimu/core';
import { colors } from '@mwalimu/ui';
import { Constants } from '@mwalimu/types';
import type { Tables } from '@mwalimu/types';
import {
  Button, Card, centredContent, Chip, ErrorBanner, NoticeStrip, WhyDisabled,
} from '../../components/ui';
import { AdminOnly } from '../../components/admin-only';
import { publishArticle } from '../../lib/content';

type Topic = Tables<'news_articles'>['topic'];

const TOPICS = Constants.public.Enums.news_topic;

const input = 'rounded-md border border-border bg-card px-3 py-2.5 text-[14px] text-foreground';

function Field({
  label, value, onChangeText, placeholder, hint, multiline, maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  hint?: string;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-[11.5px] font-medium text-mutedForeground">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.mutedForeground}
        multiline={multiline ?? false}
        maxLength={maxLength}
        textAlignVertical={multiline === true ? 'top' : 'center'}
        className={`${input} ${multiline === true ? 'min-h-[120px]' : 'h-11'}`}
      />
      {hint === undefined ? null : (
        <Text className="text-[10.5px] leading-4 text-mutedForeground">{hint}</Text>
      )}
    </View>
  );
}

/**
 * Publishing an update.
 *
 * The six articles that shipped with the app were invented claims attributed
 * to TSC, KNEC and KICD, dated, with no body and no source link — a rumour
 * with a timestamp. They are deleted, and this is what replaces them: the
 * platform speaking in its own voice, with somewhere the reader can check it.
 *
 * Admin-only by policy (0018), for the same reason moderation is: this is the
 * app making statements about named institutions.
 */
function ComposeNewsScreenBody() {
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('');
  const [topic, setTopic] = useState<Topic>('tsc');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missing = [
    ...(title.trim().length >= 8 ? [] : ['a headline']),
    ...(source.trim() === '' ? ['the source'] : []),
    ...(summary.trim().length >= 20 ? [] : ['a summary of at least 20 characters']),
  ];
  const ready = missing.length === 0;

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await publishArticle({ title, source, topic, summary, body, url });
      router.replace('/news');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not publish that');
      setSaving(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Publish an update' }} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, ...centredContent }}>
        <NoticeStrip>
          This appears under your app’s name, about a named institution. Give the source and,
          wherever one exists, the link — a teacher may act on it.
        </NoticeStrip>

        <Card className="gap-3 px-3.5 py-3">
          <Field
            label="Headline"
            value={title}
            onChangeText={setTitle}
            placeholder="TSC opens applications for intern teachers"
            maxLength={160}
          />
          <Field
            label="Source"
            value={source}
            onChangeText={setSource}
            placeholder="TSC, KNEC, Ministry of Education…"
            hint="Who said it, not where you read it."
            maxLength={80}
          />
          <View className="gap-1.5">
            <Text className="text-[11.5px] font-medium text-mutedForeground">Topic</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {TOPICS.map((t) => (
                <Chip
                  key={t}
                  label={formatLabel(t)}
                  selected={topic === t}
                  onPress={() => setTopic(t)}
                />
              ))}
            </View>
          </View>
        </Card>

        <Card className="gap-3 px-3.5 py-3">
          <Field
            label="Summary"
            value={summary}
            onChangeText={setSummary}
            placeholder="Two or three sentences: what changed, and who it affects."
            multiline
            maxLength={400}
          />
          <Field
            label="Full text (optional)"
            value={body}
            onChangeText={setBody}
            placeholder="The detail, if you have it."
            multiline
            maxLength={6000}
          />
          <Field
            label="Source link"
            value={url}
            onChangeText={setUrl}
            placeholder="https://…"
            hint="Left blank, the article tells the reader to check the institution’s own notice."
            maxLength={500}
          />
        </Card>

        {error !== null ? <ErrorBanner message={error} /> : null}

        {saving ? (
          <ActivityIndicator color={colors.mutedForeground} className="py-3" />
        ) : (
          <View className="gap-2">
            <Button label="Publish" disabled={!ready} onPress={() => void submit()} />
            <WhyDisabled missing={missing} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

export default function ComposeNewsScreen() {
  return <AdminOnly><ComposeNewsScreenBody /></AdminOnly>;
}
