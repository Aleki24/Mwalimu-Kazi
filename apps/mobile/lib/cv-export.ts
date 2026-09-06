import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import {
  cvFileName, renderCvHtml, renderCvWordHtml, type CvData, type CvTemplate,
} from '@mwalimu/core';

/**
 * Turning a CV into a file the teacher can send.
 *
 * Both formats come from the one renderer in `@mwalimu/core`, so the PDF and
 * the Word file can never show different things.
 */

export type CvFormat = 'pdf' | 'word';

/** What actually happened, so the screen can say something true afterwards. */
export type ExportResult =
  | { readonly kind: 'shared'; readonly fileName: string }
  /** Written to disk, but this device has no way to hand it on. */
  | { readonly kind: 'saved'; readonly fileName: string; readonly uri: string };

async function share(uri: string, fileName: string, mimeType: string): Promise<ExportResult> {
  if (!(await Sharing.isAvailableAsync())) return { kind: 'saved', fileName, uri };
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: fileName, UTI: mimeType });
  return { kind: 'shared', fileName };
}

async function exportPdf(cv: CvData, template: CvTemplate): Promise<ExportResult> {
  const { uri } = await Print.printToFileAsync({ html: renderCvHtml(cv, template) });
  const fileName = cvFileName(cv.fullName, 'pdf');

  // printToFileAsync names the file with a random cache id. Renaming it means
  // the school receives "grace-wanjiru-cv.pdf" and not "a3f9c1....pdf", which
  // is the difference between looking organised and looking careless.
  const named = new File(Paths.cache, fileName);
  try {
    if (named.exists) named.delete();
    new File(uri).move(named);
    return await share(named.uri, fileName, 'application/pdf');
  } catch {
    // A rename is a convenience. Losing it must not lose the export.
    return await share(uri, fileName, 'application/pdf');
  }
}

async function exportWord(cv: CvData, template: CvTemplate): Promise<ExportResult> {
  const fileName = cvFileName(cv.fullName, 'doc');
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(renderCvWordHtml(cv, template));
  return await share(file.uri, fileName, 'application/msword');
}

/**
 * Never throws for a cancelled share — backing out of the share sheet is a
 * normal thing to do, not an error worth an alert.
 */
export async function exportCv(
  cv: CvData, template: CvTemplate, format: CvFormat,
): Promise<ExportResult> {
  if (Platform.OS === 'web') {
    // expo-print and expo-sharing have no web equivalent here. Opening the
    // rendered document in a new tab lets the browser's own print dialogue do
    // the PDF, which is what a web user expects anyway.
    const html = format === 'pdf' ? renderCvHtml(cv, template) : renderCvWordHtml(cv, template);
    const blob = new Blob([html], { type: format === 'pdf' ? 'text/html' : 'application/msword' });
    const url = URL.createObjectURL(blob);
    globalThis.open(url, '_blank');
    return { kind: 'saved', fileName: cvFileName(cv.fullName, format === 'pdf' ? 'pdf' : 'doc'), uri: url };
  }
  return format === 'pdf' ? await exportPdf(cv, template) : await exportWord(cv, template);
}
