import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { CV_PAGE_WIDTH, renderCvPreviewHtml, type CvData, type CvTemplate } from '@mwalimu/core';
import { colors, radius } from '@mwalimu/ui';

const A4_HEIGHT = 1123;
const A4_RATIO = A4_HEIGHT / CV_PAGE_WIDTH;

/**
 * The web half of CvPreview. react-native-webview has no web implementation,
 * so this uses an iframe — same HTML, same guarantee that what is shown is
 * what will be exported.
 *
 * The iframe is laid out at the page's true A4 size and then scaled as a
 * whole. Sizing it to the container instead would reflow the text, and a
 * preview whose line breaks differ from the PDF is worse than none.
 */
export function CvPreview({ cv, template }: { cv: CvData; template: CvTemplate }) {
  const [width, setWidth] = useState(0);
  const scale = width === 0 ? 0 : width / CV_PAGE_WIDTH;

  return (
    <View
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
      style={{
        aspectRatio: 1 / A4_RATIO,
        overflow: 'hidden',
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: '#fff',
      }}
    >
      {scale === 0 ? null : (
        <iframe
          title="CV preview"
          srcDoc={renderCvPreviewHtml(cv, template)}
          // allow-same-origin WITHOUT allow-scripts: a fully opaque sandbox
          // makes the document throw a SecurityError the moment anything in
          // the frame touches storage, and it logged one on every render.
          // Scripts stay blocked, which is the part that matters — the page is
          // CV text with no JavaScript in it at all.
          sandbox="allow-same-origin"
          scrolling="no"
          style={{
            width: CV_PAGE_WIDTH,
            height: A4_HEIGHT,
            border: 'none',
            position: 'absolute',
            top: 0,
            left: 0,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      )}
    </View>
  );
}
