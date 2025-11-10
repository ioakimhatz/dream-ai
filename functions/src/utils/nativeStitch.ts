// functions/src/utils/nativeStitch.ts - DISABLED IN CLOUD FUNCTIONS
// Native modules don't work in Cloud Functions, so this throws immediately
// Your code will fall back to Cloudinary stitching

export async function stitchNative(videoUrls: string[]): Promise<string> {
  console.log('⚠️ Native stitching not available in Cloud Functions, will use Cloudinary');
  throw new Error('Native stitching not available in Cloud Functions');
}
