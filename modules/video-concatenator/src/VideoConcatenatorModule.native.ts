import { NativeModule } from 'expo-modules-core';

export default {
  concatenateVideos(videoPaths: string[], outputName: string): Promise<string> {
    // This will be replaced by the native implementation
    throw new Error('Native module not loaded');
  }
} as NativeModule;