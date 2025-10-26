// app/utils/faceEnhancer.ts
import * as fal from "@fal-ai/serverless-client";

fal.config({
  credentials: process.env.EXPO_PUBLIC_FAL_KEY,
});

export async function enhanceFaceConsistency(
  videoUrls: string[],
  originalFaceUri: string,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  console.log("🎭 Enhancing face consistency for", videoUrls.length, "videos");

  const enhancedVideos: string[] = [];

  for (let i = 0; i < videoUrls.length; i++) {
    onProgress?.(i + 1, videoUrls.length);

    try {
      const enhanced = await swapFaceInVideo(videoUrls[i], originalFaceUri);
      enhancedVideos.push(enhanced);
    } catch (err) {
      console.warn(`Face swap failed for video ${i}, using original`, err);
      enhancedVideos.push(videoUrls[i]);
    }
  }

  return enhancedVideos;
}

async function swapFaceInVideo(
  videoUrl: string,
  faceImageUrl: string
): Promise<string> {
  try {
    try {
      const result: any = await fal.subscribe("fal-ai/face-swap-video", {
        input: {
          video_url: videoUrl,
          face_image_url: faceImageUrl,
        },
      });
      return result.video.url;
    } catch (err) {
      console.log("Video face swap not available");
    }

    return await frameByFrameFaceSwap(videoUrl, faceImageUrl);

  } catch (err) {
    console.error("Face swap failed:", err);
    throw err;
  }
}

async function frameByFrameFaceSwap(
  videoUrl: string,
  faceImageUrl: string
): Promise<string> {
  console.log("⚠️ Frame-by-frame face swap not implemented yet");
  return videoUrl;
}

export async function enhanceFaceDetails(videoUrl: string): Promise<string> {
  try {
    const result: any = await fal.subscribe("fal-ai/face-restore", {
      input: {
        video_url: videoUrl,
        strength: 0.8,
      },
    });
    return result.video.url;
  } catch (err) {
    console.warn("Face restoration failed:", err);
    return videoUrl;
  }
}

export async function multiPassFaceEnhancement(
  videoUrl: string,
  faceImageUrl: string
): Promise<string> {
  try {
    const swapped = await swapFaceInVideo(videoUrl, faceImageUrl);
    const enhanced = await enhanceFaceDetails(swapped);
    return enhanced;
  } catch (err) {
    console.error("Multi-pass enhancement failed:", err);
    return videoUrl;
  }
}