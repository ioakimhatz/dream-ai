import { NativeModules } from 'react-native';

const LINKING_ERROR =
  "VideoConcatenator native module not found. Did you run prebuild & pod install?";

const Native: { concatenateVideos(urls: string[], outputName: string): Promise<string> } =
  NativeModules.VideoConcatenator ??
  new Proxy({}, { get() { throw new Error(LINKING_ERROR); } });

export function concatenateVideos(urls: string[], outputName: string) {
  return Native.concatenateVideos(urls, outputName);
}

export default { concatenateVideos };
