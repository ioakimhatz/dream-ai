// app/utils/addAudioToVideo.ts - FINAL VERSION
import * as FileSystem from "expo-file-system";

function falKey(): string {
  const k =
    process.env.EXPO_PUBLIC_FAL_API_KEY_1 ||
    process.env.EXPO_PUBLIC_FAL_API_KEY ||
    process.env.EXPO_PUBLIC_FAL_KEY;
  if (!k) throw new Error("Missing FAL API key");
  return k;
}

/**
 * Adds AI-generated sound effects to a video using Mirelo SFX
 * @param videoUrl - Remote URL of the video (must be publicly accessible)
 * @param textPrompt - Description to guide the audio generation
 * @param duration - Duration in seconds (default: 5 for your 5s clips)
 * @returns Local path to the video with audio
 */
export async function addAudioToVideo(
  videoUrl: string,
  textPrompt: string,
  duration: number = 5
): Promise<string> {
  const endpoint = "https://fal.run/mirelo-ai/sfx-v1/video-to-video";
  
  const body = {
    video_url: videoUrl,
    text_prompt: textPrompt,
    num_samples: 2,
    seed: Math.floor(Math.random() * 10000),
    duration: duration,
  };

  console.log(`🎵 Adding audio to video with prompt: "${textPrompt.substring(0, 50)}..."`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mirelo SFX failed ${response.status}: ${errorText}`);
  }

  const result = await response.json();
  
  const videoWithAudio = result?.video?.[0];
  
  if (!videoWithAudio?.url) {
    throw new Error("Mirelo SFX: no video URL in response");
  }

  const remoteUrl = videoWithAudio.url;
  console.log(`✅ Audio added! Downloading from: ${remoteUrl}`);

  const localPath = `${FileSystem.documentDirectory}mirelo_audio_${Date.now()}.mp4`;
  const downloadResult = await FileSystem.downloadAsync(remoteUrl, localPath);

  console.log(`✅ Video with audio saved locally: ${downloadResult.uri}`);
  return downloadResult.uri;
}

export default {};