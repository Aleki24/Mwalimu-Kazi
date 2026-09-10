import * as ImagePicker from 'expo-image-picker';

/**
 * A photograph, chosen from the device, as bytes ready to upload.
 *
 * `expo-image-picker` returns a URI on every platform — a `file://` path on a
 * phone, a `blob:` URL on the web — so one `fetch` covers both rather than a
 * `.web.ts` twin. Returning a Blob and not a URI is deliberate: the caller
 * uploads it and never has to know which platform it came from.
 *
 * Cropped to 3:4 on the way in. A CV photograph is a passport photograph, and
 * letting a landscape selfie into a portrait frame produces the thing that
 * makes a document look homemade.
 */
export interface PickedPhoto {
  readonly blob: Blob;
  /** `jpg`, `png`, `webp` — what the storage path is named after. */
  readonly extension: string;
}

const EXTENSION: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Null when the person backed out, which is not an error. */
export async function pickPhoto(): Promise<PickedPhoto | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Mwalimu Kazi needs permission to open your photos.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [3, 4],
    quality: 0.85,
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (asset === undefined) return null;

  const response = await fetch(asset.uri);
  const blob = await response.blob();
  // The bucket only accepts these three, so a HEIC from an iPhone has to be
  // refused here with something a person can act on rather than by a 400 from
  // storage that says "mime type not allowed".
  const extension = EXTENSION[blob.type];
  if (extension === undefined) {
    throw new Error('That has to be a JPEG, PNG or WebP image.');
  }
  if (blob.size > 3 * 1024 * 1024) {
    throw new Error('That photograph is over 3 MB. Choose a smaller one.');
  }
  return { blob, extension };
}
