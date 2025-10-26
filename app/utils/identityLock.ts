// app/utils/identityLock.ts
// Build a DATA URL (base64) once per local image, so we can reuse it across clips.

import * as FileSystem from 'expo-file-system';

const _cache = new Map<string, string>(); // localUri -> dataURL

function guessMime(uri: string): string {
  const lc = uri.toLowerCase();
  if (lc.endsWith('.png')) return 'image/png';
  if (lc.endsWith('.jpg') || lc.endsWith('.jpeg')) return 'image/jpeg';
  if (lc.startsWith('data:image/')) {
    // Already a data URL
    const match = lc.match(/^data:(image\/[a-z+0-9.-]+);base64,/);
    if (match) return match[1];
  }
  return 'image/jpeg';
}

/**
 * Reads a local image file and returns a data URL (data:image/...;base64,XXXX).
 * Cached by local URI to avoid repeated FS reads.
 */
export async function getOrCreateIdentityImageUrl(localImageUri: string): Promise<string> {
  if (!localImageUri) throw new Error('getOrCreateIdentityImageUrl: missing localImageUri');
  if (_cache.has(localImageUri)) return _cache.get(localImageUri)!;

  // If it’s already a data URL, just cache & return
  if (localImageUri.startsWith('data:image/')) {
    _cache.set(localImageUri, localImageUri);
    return localImageUri;
  }

  const mime = guessMime(localImageUri);
  const base64 = await FileSystem.readAsStringAsync(localImageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const dataUrl = `data:${mime};base64,${base64}`;
  _cache.set(localImageUri, dataUrl);
  return dataUrl;
}

// (Optional) helper if you ever need to clear cache between sessions
export function clearIdentityCache() {
  _cache.clear();
}
