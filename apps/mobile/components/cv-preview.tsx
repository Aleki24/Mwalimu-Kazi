import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { CV_PAGE_WIDTH, renderCvPreviewHtml, type CvData, type CvTemplate } from '@mwalimu/core';
import { colors, radius } from '@mwalimu/ui';

/** A4 at 96dpi. The preview keeps the page's real proportions, not a guess. */
const A4_RATIO = 1123 / CV_PAGE_WIDTH;

/**
 * A live page preview.
 *
 * A WebView rather than a native re-implementation of the layout: the export
 * is HTML, and anything drawn a second way in React Native would drift from it
 * silently. This shows the document itself.
 *
 * `.web.tsx` alongside this file does the same job with an iframe —
 * react-native-webview has no web implementation.
 */
export function CvPreview({ cv, template }: { cv: CvData; template: CvTemplate }) {
  return (
    <View
      style={{
        aspectRatio: 1 / A4_RATIO,
        overflow: 'hidden',
        borderRadius: radius.md,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: '#fff',
      }}
    >
      <WebView
        originWhitelist={['*']}
        source={{ html: renderCvPreviewHtml(cv, template) }}
        // It is a preview, not a document viewer: scrolling and links inside
        // it would fight the screen's own scroll.
        scrollEnabled={false}
        scalesPageToFit
        javaScriptEnabled={false}
        style={{ backgroundColor: '#fff' }}
      />
    </View>
  );
}
