import VideoConcatenatorModule from './VideoConcatenatorModule';

export async function concatenateVideos(videoPaths: string[], outputName: string): Promise<string> {
  return VideoConcatenatorModule.concatenateVideos(videoPaths, outputName);
}