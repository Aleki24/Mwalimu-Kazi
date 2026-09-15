import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { CV_TEMPLATES, sectionsFrom, type CvSection, type CvStyle } from '@mwalimu/core';
import { colors, radius } from '@mwalimu/ui';
import { Card, centredContent, ErrorBanner } from '../../components/ui';
import { CvPreview } from '../../components/cv-preview';
import { StyleControls } from '../../components/style-controls';
import { SectionOrder } from '../../components/section-order';
import { useTeacher } from '../../lib/auth';
import {
  EMPTY_CV, fetchCv, fetchPhotoDataUri, saveCvDetails, saveSectionOrder, styleColumns,
  toCvData, toCvStyle, withRenamedSection, type CvRecord,
} from '../../lib/cv';
import { exportCv, type CvFormat } from '../../lib/cv-export';

/**
 * The document, at the size it will print.
 *
 * It used to sit at the bottom of the CV form, below eleven sections of
 * inputs, which is the one place nobody looks while filling a form in — and it
 * re-rendered a whole A4 page on every save. Here it is the whole screen, and
 * it is where the look is chosen, because choosing a template is something you
 * do by looking at the result rather than by reading its name.
 *
 * The order of the sections and the words over them are chosen here too, for
 * the same reason. Dragging "Employment" above "Education" on the editor moved
 * a row in a list of names; here it moves the block on the page, and you can
 * see which one you meant.
 */
export default function CvPreviewScreen() {
  const teacher = useTeacher();
  const insets = useSafeAreaInsets();

  const [cv, setCv] = useState<CvRecord>(EMPTY_CV);
  const [photo, setPhoto] = useState<string | null>(null);
  const [style, setStyle] = useState<CvStyle | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(false);
  /*
    Held beside the record rather than derived from it on every render: a
    reorder saves in the background, and a list that waited for the round trip
    would snap back under the finger that moved it.
  */
  const [sections, setSections] = useState<readonly CvSection[]>([]);

  const document = useMemo(() => {
    const base = toCvData(teacher, cv, photo);
    // The order being dragged wins over the one the record was loaded with, so
    // the page moves under the finger that moved the row. The list is only
    // empty before the first load, when nothing is on screen to disagree with.
    return sections.length === 0 ? base : { ...base, sections };
  }, [teacher, cv, photo, sections]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const record = await fetchCv();
        if (cancelled) return;
        setCv(record);
        setSections(sectionsFrom(record.sections.map((r) => ({ key: r.section, title: r.title }))));
        setStyle(toCvStyle(record.details));
        setPhoto(await fetchPhotoDataUri(record.details?.photo_path ?? null));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Could not load your CV');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /*
    The look is saved as it is chosen, not behind a button.

    Nothing here can be got wrong in a way that needs confirming, and the
    alternative — picking a template, leaving, and finding the old one still
    stored — is the bug that "Save lists" already taught us about.
  */
  const choose = useCallback((next: CvStyle) => {
    setStyle(next);
    void (async () => {
      try {
        await saveCvDetails(teacher.id, styleColumns(next));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not save that look');
      }
    })();
  }, [teacher.id]);

  /**
   * A reorder or a rename: shown at once, written behind it.
   *
   * Every row carries its position, so the whole list is written rather than
   * the one row that moved — two sections claiming the same place would leave
   * the order decided by whichever the database returned first.
   */
  const saveOrder = (next: readonly CvSection[]) => {
    setSections(next);
    void (async () => {
      try {
        await saveSectionOrder(teacher.id, next);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not save that order');
      }
    })();
  };

  const doExport = async (format: CvFormat) => {
    if (style === null) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const result = await exportCv(document, style, format);
      setNote(result.kind === 'shared'
        ? `${result.fileName} is ready to send.`
        : `Saved as ${result.fileName}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not build your CV file');
    } finally {
      setBusy(false);
    }
  };

  if (loading || style === null) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ title: 'Preview' }} />
        <ActivityIndicator color={colors.mutedForeground} className="py-10" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Preview' }} />
      <ScrollView
        contentContainerStyle={{
          padding: 16, gap: 12, paddingBottom: insets.bottom + 96, ...centredContent,
        }}
      >
        {error !== null ? <ErrorBanner message={error} /> : null}

        <CvPreview cv={document} style={style} />

        <Pressable
          accessibilityRole="button"
          aria-expanded={showControls}
          onPress={() => setShowControls((v) => !v)}
          className="min-h-[44px] flex-row items-center justify-center gap-1.5"
        >
          <Feather
            name={showControls ? 'chevron-up' : 'sliders'}
            size={14}
            color={colors.primary}
          />
          <Text className="text-[12.5px] font-medium text-primary">
            {showControls
              ? 'Hide the controls'
              : `Change the look and order — ${CV_TEMPLATES[style.template]}`}
          </Text>
        </Pressable>

        {showControls ? (
          <>
            <Card className="px-3.5 py-3.5">
              <StyleControls style={style} onChange={choose} />
            </Card>

            {/*
              The order lives beside the look rather than on the editor. Moving
              "Employment" above "Education" there rearranged a list of names;
              here it rearranges the page above it, which is the thing anyone
              was actually trying to decide.
            */}
            <Card className="gap-2.5 px-3.5 py-3.5">
              <Text className="text-[12.5px] font-medium text-foreground">
                Order and headings
              </Text>
              <SectionOrder
                sections={sections}
                onReorder={saveOrder}
                onRename={(key, title) => saveOrder(withRenamedSection(sections, key, title))}
              />
            </Card>
          </>
        ) : null}

        {note === null ? null : (
          <Text className="text-center text-[11.5px] text-successForeground">{note}</Text>
        )}
      </ScrollView>

      {/*
        The two downloads float over the page rather than sitting at the end of
        it: this screen is a document you scroll, and a reader three pages down
        should not have to come back to the bottom to send it.
      */}
      <View
        pointerEvents="box-none"
        style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 12 }}
      >
        {/* Padding, not margin: `centredContent` pins the width to 100%, so a
            horizontal margin on the same element pushes it off the screen
            instead of insetting it — which is the repo's own pattern for this
            pairing everywhere else. */}
        <View style={centredContent} className="flex-row gap-2 px-4">
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void doExport('pdf')}
            style={{ borderRadius: radius.md, borderCurve: 'continuous' }}
            className="h-12 flex-1 flex-row items-center justify-center gap-1.5 bg-primary"
          >
            <Feather name="download" size={15} color={colors.primaryForeground} />
            <Text className="text-[13.5px] font-medium text-primaryForeground">PDF</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void doExport('word')}
            style={{ borderRadius: radius.md, borderCurve: 'continuous' }}
            className="h-12 flex-1 flex-row items-center justify-center gap-1.5 border border-border bg-card"
          >
            <Feather name="download" size={15} color={colors.foreground} />
            <Text className="text-[13.5px] font-medium text-foreground">Word</Text>
          </Pressable>
        </View>
      </View>

      {busy ? (
        <ActivityIndicator
          color={colors.mutedForeground}
          style={{ position: 'absolute', bottom: insets.bottom + 70, left: 0, right: 0 }}
        />
      ) : null}
    </View>
  );
}
