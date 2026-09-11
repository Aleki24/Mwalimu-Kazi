import { Pressable, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import {
  CV_ACCENTS, CV_BACKGROUNDS, CV_FONTS, CV_SCALE_LABEL, CV_TEMPLATES, CV_TEMPLATE_HINT,
  styleFor, type CvAccent, type CvBackground, type CvFont, type CvScale, type CvStyle,
  type CvTemplate,
} from '@mwalimu/core';
import { colors, radius } from '@mwalimu/ui';
import { Chip } from './ui';

/**
 * The dials, in the order someone actually reaches for them.
 *
 * Template first, because it moves everything at once; then the two things
 * people change immediately after picking one — the colour and the face — and
 * only then the spacing, which is what you reach for when the document is
 * nearly right and running four lines onto a second page.
 */

const SCALES: readonly CvScale[] = [1, 2, 3, 4, 5];

/** The colour a swatch shows. Mirrors the palette the renderer uses. */
const SWATCH: Readonly<Record<CvAccent, string>> = {
  ink: '#111111',
  indigo: '#3d7ea9',
  teal: '#4f9c8a',
  maroon: '#a63f2f',
  violet: '#6d5cc0',
  slate: '#5b6875',
  terracotta: '#c06c44',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-[11px] font-medium uppercase tracking-wider text-mutedForeground">
        {label}
      </Text>
      {children}
    </View>
  );
}

/**
 * Five stops, not a slider.
 *
 * A slider on a phone is a drag target beside a scrolling page, and it commits
 * a value on every pixel of movement — for something that re-renders an A4
 * document each time, five taps are both calmer and cheaper.
 */
function Scale({
  value, onChange, label,
}: { value: CvScale; onChange: (v: CvScale) => void; label: string }) {
  return (
    <Row label={label}>
      <View className="flex-row gap-1.5">
        {SCALES.map((n) => (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityState={{ selected: value === n }}
            aria-pressed={value === n}
            accessibilityLabel={`${label}: ${CV_SCALE_LABEL[n]}`}
            onPress={() => onChange(n)}
            style={{ borderRadius: radius.md }}
            className={`h-9 flex-1 items-center justify-center border ${
              value === n ? 'border-primary bg-primary' : 'border-border bg-card'
            }`}
          >
            <Text className={`text-[11.5px] font-medium ${
              value === n ? 'text-primaryForeground' : 'text-mutedForeground'
            }`}
            >
              {CV_SCALE_LABEL[n]}
            </Text>
          </Pressable>
        ))}
      </View>
    </Row>
  );
}

export function StyleControls({
  style, onChange,
}: { style: CvStyle; onChange: (next: CvStyle) => void }) {
  const set = <K extends keyof CvStyle>(key: K, value: CvStyle[K]) =>
    onChange({ ...style, [key]: value });

  return (
    <View className="gap-4">
      <Row label="Template">
        <View className="flex-row flex-wrap gap-1.5">
          {(Object.keys(CV_TEMPLATES) as CvTemplate[]).map((t) => (
            <Chip
              key={t}
              label={CV_TEMPLATES[t]}
              selected={style.template === t}
              // A template is a set of starting positions, so picking one
              // moves the colour and the face with it. Keeping the old accent
              // would mean choosing "Bold" and getting the blue one.
              onPress={() => onChange(styleFor(t))}
            />
          ))}
        </View>
        <Text className="text-[11px] leading-4 text-mutedForeground">
          {CV_TEMPLATE_HINT[style.template]}
        </Text>
      </Row>

      <Row label="Colour">
        <View className="flex-row flex-wrap gap-2">
          {(Object.keys(CV_ACCENTS) as CvAccent[]).map((a) => (
            <Pressable
              key={a}
              accessibilityRole="button"
              accessibilityState={{ selected: style.accent === a }}
              aria-pressed={style.accent === a}
              accessibilityLabel={CV_ACCENTS[a]}
              onPress={() => set('accent', a)}
              style={{ borderRadius: radius.md }}
              className={`h-10 w-10 items-center justify-center border-2 ${
                style.accent === a ? 'border-primary' : 'border-transparent'
              }`}
            >
              <View
                style={{ backgroundColor: SWATCH[a], borderRadius: radius.sm }}
                className="h-7 w-7"
              />
            </Pressable>
          ))}
        </View>
      </Row>

      <Row label="Font">
        <View className="flex-row flex-wrap gap-1.5">
          {(Object.keys(CV_FONTS) as CvFont[]).map((f) => (
            <Chip
              key={f}
              label={CV_FONTS[f]}
              selected={style.font === f}
              onPress={() => set('font', f)}
            />
          ))}
        </View>
        <Text className="text-[11px] leading-4 text-mutedForeground">
          Only faces already on the device. A CV set in a font that has to be
          downloaded reflows into something you never saw when it prints.
        </Text>
      </Row>

      <Scale label="Text size" value={style.fontScale} onChange={(v) => set('fontScale', v)} />
      <Scale label="Line height" value={style.lineHeight} onChange={(v) => set('lineHeight', v)} />
      <Scale label="Entry spacing" value={style.entrySpacing} onChange={(v) => set('entrySpacing', v)} />
      <Scale label="Section spacing" value={style.sectionSpacing} onChange={(v) => set('sectionSpacing', v)} />
      <Scale label="Page margins" value={style.margins} onChange={(v) => set('margins', v)} />

      <Row label="Background">
        <View className="flex-row flex-wrap gap-1.5">
          {(Object.keys(CV_BACKGROUNDS) as CvBackground[]).map((b) => (
            <Chip
              key={b}
              label={CV_BACKGROUNDS[b]}
              selected={style.background === b}
              onPress={() => set('background', b)}
            />
          ))}
        </View>
      </Row>

      <Pressable
        accessibilityRole="button"
        onPress={() => onChange(styleFor(style.template))}
        className="flex-row items-center gap-1.5 py-1"
      >
        <Feather name="rotate-ccw" size={13} color={colors.mutedForeground} />
        <Text className="text-[12px] font-medium text-mutedForeground">
          Back to how {CV_TEMPLATES[style.template]} started
        </Text>
      </Pressable>
    </View>
  );
}
