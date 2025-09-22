// app/utils/generateVideoFal.ts - DREAM AI CINEMA ENGINE

import * as FileSystem from 'expo-file-system';
import { stitchNative } from './nativeStitch';   // ✅ native-first
import { stitchClips } from './stitcher';        // ✅ cloud fallback

// Multiple API keys for parallel generation
const FAL_API_KEYS = [
  process.env.EXPO_PUBLIC_FAL_API_KEY_1,
  process.env.EXPO_PUBLIC_FAL_API_KEY_2,
  process.env.EXPO_PUBLIC_FAL_API_KEY_3,
];

// Fallback to single key if others not provided
const getApiKey = (index: number): string => {
  const key = FAL_API_KEYS[index] || process.env.EXPO_PUBLIC_FAL_API_KEY;
  if (!key) {
    throw new Error(`Dream AI API key ${index + 1} not configured`);
  }
  return key;
};

// Optional thumbnail generation
async function extractVideoThumbnail(videoUri: string): Promise<string | null> {
  try {
    const VideoThumbnails = await import('expo-video-thumbnails').catch(() => null);

    if (VideoThumbnails) {
      const thumbnail = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: 1000,
        quality: 0.8,
      });
      return thumbnail.uri;
    }

    console.warn('expo-video-thumbnails not available, skipping thumbnail generation');
    return null;
  } catch (error) {
    console.warn('Failed to extract thumbnail:', error);
    return null;
  }
}

// Single video generation with Dream AI Engine
export async function generateSingleDreamVideoWithKey(
  prompt: string,
  apiKeyIndex: number = 0,
  imageUri?: string
): Promise<{ videoUrl: string; coverUrl: string | null }> {
  const apiKey = getApiKey(apiKeyIndex);

  console.log(`🎬 [DREAM AI ${apiKeyIndex + 1}] Creating dream sequence...`);
  console.log(`📝 Scene: ${prompt.slice(0, 50)}...`);
  console.log(`🔑 Using Dream Engine ${apiKeyIndex + 1}`);

  try {
    let endpoint: string;
    let requestBody: any;

    if (imageUri && apiKeyIndex === 0) {
      // Dream AI image-to-video for person consistency
      console.log('📷 [DREAM AI] Adding your person to the dream...');

      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Internal endpoint (hidden from user)
      endpoint = 'https://fal.run/fal-ai/minimax/hailuo-02/standard/image-to-video';
      requestBody = {
        prompt: prompt,
        image_url: `data:image/jpeg;base64,${base64}`,
      };
    } else {
      // Dream AI text-to-video
      console.log('📝 [DREAM AI] Generating dream visuals...');

      // Internal endpoint (hidden from user)
      endpoint = 'https://fal.run/fal-ai/minimax/hailuo-02/standard/text-to-video';
      requestBody = {
        prompt: prompt,
      };
    }

    console.log(`🚀 [DREAM AI ${apiKeyIndex + 1}] Processing dream sequence...`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [DREAM AI ${apiKeyIndex + 1}] Processing Error:`, response.status, errorText);

      if (response.status === 402) {
        throw new Error(`Insufficient Dream AI credits on engine ${apiKeyIndex + 1}`);
      } else if (response.status === 401) {
        throw new Error(`Dream AI configuration error ${apiKeyIndex + 1}`);
      }

      throw new Error(`Dream AI processing error: ${response.status}`);
    }

    const result = await response.json();
    console.log('🔍 [DREAM AI] Processing complete');

    // Handle response format
    const remoteVideoUrl: string | undefined =
      result.video?.url || result.url || result.data?.url || result.video_url;

    if (!remoteVideoUrl) {
      console.error('❌ No video URL found in Dream AI response');
      throw new Error('Dream AI generation incomplete');
    }

    console.log(`✅ [DREAM AI ${apiKeyIndex + 1}] Dream sequence created successfully!`);
    console.log('🎥 Dream ready for viewing');
    console.log('✨ Dream quality: Cinema HD');

    // Download video locally for better playback + native stitching
    const localFileName = `dream_${apiKeyIndex + 1}_${Date.now()}.mp4`;
    const localPath = `${FileSystem.documentDirectory}${localFileName}`;

    console.log(`⬇️ [DREAM AI ${apiKeyIndex + 1}] Saving dream locally...`);
    const downloadResult = await FileSystem.downloadAsync(remoteVideoUrl, localPath);
    console.log(`📁 Dream saved: ${downloadResult.uri}`);

    // Try to generate thumbnail
    let coverUrl: string | null = null;
    try {
      coverUrl = await extractVideoThumbnail(downloadResult.uri);
      if (coverUrl) console.log('🖼️ Dream preview generated');
    } catch {
      console.warn('⚠️ Preview generation skipped');
    }

    return {
      videoUrl: downloadResult.uri, // local file:// URI
      coverUrl,
    };
  } catch (error: any) {
    console.error(`❌ [DREAM AI ${apiKeyIndex + 1}] Generation failed:`, error);
    throw new Error(`Dream AI Engine ${apiKeyIndex + 1} failed: ${error.message}`);
  }
}

// PARALLEL 3-CLIP DREAM CINEMA GENERATION
export async function generate3ClipDreamCinemaParallel(
  fullPrompt: string,
  imageUri?: string,
  onProgress?: (completed: number, total: number, step: string) => void
): Promise<{
  videoUrls: string[];
  stitchedVideoUrl: string;
  coverUrl: string | null;
  totalCost: number;
  generationTime: number;
}> {
  const startTime = Date.now();
  console.log('🚀 [DREAM AI] Starting dream cinema creation...');
  console.log('⚡ Dream AI Cinema Engine v2.0 - Ultra-fast processing');
  console.log('✨ Creating your personalized dream experience');

  try {
    // Step 1: Split prompt into 3 acts
    onProgress?.(0, 3, 'Dream AI is analyzing your story...');
    const acts = await splitPromptInto3Acts(fullPrompt, !!imageUri);
    console.log('📝 [DREAM AI] Story structured into cinematic acts');

    // Step 2: Generate all 3 videos in parallel
    onProgress?.(0, 3, 'Dream AI is creating your scenes...');
    console.log('🎬 [DREAM AI] Rendering dream sequences simultaneously...');

    const generationPromises = acts.map((act, index) =>
      generateSingleDreamVideoWithKey(
        act,
        index, // Use different API key for each video
        index === 0 ? imageUri : undefined // Only first video gets image for character consistency
      )
        .then((result) => {
          console.log(`✅ [DREAM AI] Sequence ${index + 1}/3 completed`);
          onProgress?.(index + 1, 3, `Dream sequence ${index + 1}/3 ready`);
          return result;
        })
        .catch((error) => {
          console.error(`❌ [DREAM AI] Sequence ${index + 1} failed:`, error);
          throw new Error(`Dream sequence ${index + 1} failed: ${error.message}`);
        })
    );

    // Wait for all videos to complete
    const videoResults = await Promise.all(generationPromises);

    const generationTime = Date.now() - startTime;
    console.log(`⚡ [DREAM AI] All sequences created in ${Math.round(generationTime / 1000)}s`);

    const videoUrls = videoResults.map((r) => r.videoUrl); // local file:// URIs
    const firstCover = videoResults[0]?.coverUrl ?? null;

    // Step 3: Stitch videos (Native first → Cloudinary fallback)
    onProgress?.(3, 3, 'Dream AI is finalizing your cinema...');
    console.log('🎬 [DREAM AI] Combining sequences into cinematic experience...');

    let stitchedVideoUrl = videoUrls[0]; // default fallback if both methods fail

    try {
      // ✅ Native: expects local file:// URIs
      stitchedVideoUrl = await stitchNative(videoUrls);
      console.log('✅ [NATIVE] dream cinema created (local)');
    } catch (e) {
      console.warn('⚠️ Native stitching failed, falling back to Cloudinary splice', e);
      try {
        // Cloudinary splice expects exactly 3 sources (file:// or https://)
        const clips = [videoUrls[0], videoUrls[1], videoUrls[2]] as [string, string, string];
        stitchedVideoUrl = await stitchClips(clips, (step) => console.log(`🔧 [DREAM AI] ${step}`));
        console.log('✅ [CLOUDINARY] dream cinema created');
      } catch (cloudErr) {
        console.error('❌ Both native and Cloudinary stitching failed; using first clip', cloudErr);
      }
    }

    const totalTime = Date.now() - startTime;

    console.log(`🎉 [DREAM AI SUCCESS] Dream cinema completed in ${Math.round(totalTime / 1000)}s`);
    console.log(`✨ Your dream is ready to experience!`);

    return {
      videoUrls,
      stitchedVideoUrl,
      coverUrl: firstCover,
      totalCost: 0.81, // Internal cost tracking
      generationTime: totalTime,
    };
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [DREAM AI] Failed after ${Math.round(totalTime / 1000)}s:`, error);
    throw new Error(`Dream AI cinema generation failed: ${error.message}`);
  }
}

// Enhanced prompt splitting for Dream AI
async function splitPromptInto3Acts(
  fullPrompt: string,
  hasFace: boolean
): Promise<string[]> {
  const openaiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

  if (!openaiKey) {
    console.log('⚠️ Using Dream AI auto-split');
    return [
      `${fullPrompt}. OPENING SCENE: Wide establishing cinematic shot introducing the environment and character with atmospheric lighting and mood.`,
      `${fullPrompt}. MAIN ACTION: Dynamic medium shot capturing the primary movement and story development with smooth camera work.`,
      `${fullPrompt}. CLIMAX MOMENT: Close-up emotional conclusion showing character reaction with dramatic depth of field and lighting.`,
    ];
  }

  try {
    console.log('🤖 Dream AI is creating cinematic structure...');

    const systemPrompt = `Create 3 video prompts for Dream AI Cinema Engine. Each prompt will generate a 6-second dream sequence.

Requirements for Dream AI:
- Each prompt must be detailed and cinematic
- Include specific camera movements and angles  
- Rich visual descriptions for dream-like quality
- Character consistency across all 3 scenes
${hasFace ? '- Maintain the same person appearance in all scenes' : ''}
- Each scene should feel like part of a complete dream story

Structure:
- Act 1: Wide establishing shot introducing setting and character
- Act 2: Medium shot with main action or character development
- Act 3: Close-up emotional climax or resolution

Return JSON: {"acts": ["detailed_act1", "detailed_act2", "detailed_act3"]}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Create 3 Dream AI cinema acts: "${fullPrompt}"` },
        ],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const parsed = JSON.parse(result.choices[0]?.message?.content || '{}');

      if (parsed.acts && Array.isArray(parsed.acts) && parsed.acts.length === 3) {
        console.log('✅ Dream AI structured your story perfectly');
        return parsed.acts;
      }
    }

    throw new Error('AI structuring incomplete');
  } catch {
    console.warn('⚠️ Using Dream AI fallback structure');

    return [
      `${fullPrompt} - ESTABLISHING: Wide cinematic shot introducing the full dream scene with professional lighting and atmosphere.`,
      `${fullPrompt} - DEVELOPMENT: Medium shot capturing dynamic dream action with smooth camera movement and character focus.`,
      `${fullPrompt} - RESOLUTION: Close-up emotional dream moment with dramatic lighting and shallow depth of field.`,
    ];
  }
}

// Legacy compatibility - redirects to Dream AI
export async function generateVideoFal(
  prompt: string,
  durationSeconds: number = 8,
  imageUri?: string
): Promise<{ videoUrl: string; coverUrl: string | null }> {
  console.log('🔄 [DREAM AI] Initializing cinema generation...');

  const result = await generate3ClipDreamCinemaParallel(prompt, imageUri);

  return {
    videoUrl: result.stitchedVideoUrl,
    coverUrl: result.coverUrl,
  };
}

// Check if Dream AI is properly configured
export function checkParallelSetup(): {
  configured: boolean;
  availableKeys: number;
  missingKeys: string[];
} {
  const availableKeys = FAL_API_KEYS.filter((key) => !!key).length;
  const missingKeys: string[] = [];

  if (!FAL_API_KEYS[0]) missingKeys.push('DREAM_AI_KEY_1');
  if (!FAL_API_KEYS[1]) missingKeys.push('DREAM_AI_KEY_2');
  if (!FAL_API_KEYS[2]) missingKeys.push('DREAM_AI_KEY_3');

  return {
    configured: availableKeys >= 3,
    availableKeys,
    missingKeys,
  };
}

// Check Dream AI service status
export async function checkDreamAIStatus(): Promise<boolean> {
  const apiKey = getApiKey(0);

  try {
    const response = await fetch('https://fal.run/health', {
      method: 'GET',
      headers: {
        Authorization: `Key ${apiKey}`,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

export { extractVideoThumbnail };
