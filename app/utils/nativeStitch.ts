import { concatenateVideos } from '../../modules/video-concatenator/src';
import * as FileSystem from 'expo-file-system';

export async function stitchNative(localUris: string[]): Promise<string> {
  if (localUris.length < 2) throw new Error('Need at least 2 clips');
  const outputName = `dream_cinema_${Date.now()}`;
  const path = await concatenateVideos(localUris, outputName); // returns absolute path w/o file://
  const fileUrl = `file://${path}`;

  const info = await FileSystem.getInfoAsync(fileUrl);
  if (!info.exists || (info.size ?? 0) === 0) {
    throw new Error('Native export created an empty file');
  }
  return fileUrl;
}
