import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { concatenateVideos } from '../../modules/video-concatenator/src';

export async function stitchWithNative(videoUrls: string[]) {
  if (Platform.OS !== 'ios') throw new Error('Native stitch only on iOS for now');

  try {
    const name = `dream_cinema_${Date.now()}`;
    const out = await concatenateVideos(videoUrls, name);
    const info = await FileSystem.getInfoAsync(out.startsWith('file://') ? out : `file://${out}`);
    if (!info.exists || (info.size ?? 0) === 0) throw new Error('Empty output');
    return out.startsWith('file://') ? out : `file://${out}`;
  } catch (e) {
    // Let caller fall back to Cloudinary
    throw e;
  }
}
