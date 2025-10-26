// app/utils/generateVideoFal.ts - DREAM AI CINEMA ENGINE (Hailuo 02, identity-aware)

import * as FileSystem from 'expo-file-system';
import { stitchNative } from './nativeStitch';                // native-first (stubbed to force fallback)
import { stitchWithCloudinary } from './cloudinaryStitch';    // cloud fallback
import { getOrCreateIdentityImageUrl } from './identityLock';

type Engine = 'hailuo-02';
const ENGINE: Engine = 'hailuo-02';

// Multiple API keys for parallel generation (or fall back to single)
const FAL_API_KEYS = [
  process.env.EXPO_PUBLIC_FAL_API_KEY_1,
  process.env.EXPO_PUBLIC_FAL_API_KEY_2,
  process.env.EXPO_PUBLIC_FAL_API_KEY_3,
];

const getApiKey = (index: number): string => {
  const key = FAL_API_KEYS[index] || process.env.EXPO_PUBLIC_FAL_API_KEY;
  if (!key) throw new Error(`Dream AI API key ${index + 1} not configured`);
  return key;
};

async function extractVideoThumbnail(videoUri: string): Promise<string | null> {
  try {
    const VideoThumbnails = await import('expo-video-thumbnails').catch(() => null);
    if (!VideoThumbnails) return null;
    const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 1000, quality: 0.8 });
    return uri;
  } catch {
    return null;
  }
}

/**
 * Generate one 6s clip.
 * - clipIndex 0 uses image-to-video if identity is present (strongest lock)
 * - clipIndex > 0 uses text-to-video with a reference image hint (when supported)
 */
async function generateSingleClip(
  prompt: string,
  apiKeyIndex: number,
  identityDataUrl?: string,
  clipIndex: number = 0
): Promise<{ videoUrl: string; coverUrl: string | null }> {
  const apiKey = getApiKey(apiKeyIndex);
  const useImageToVideo = !!identityDataUrl && clipIndex === 0;

  const endpoint = useImageToVideo
    ? `https://fal.run/fal-ai/minimax/${ENGINE}/standard/image-to-video`
    : `https://fal.run/fal-ai/minimax/${ENGINE}/standard/text-to-video`;

  const body: any = { prompt: String(prompt) };

  if (identityDataUrl) {
    if (useImageToVideo) {
      body.image_url = identityDataUrl; // Hailuo accepts data URLs
    } else {
      body.reference_images = [identityDataUrl]; // harmless if engine ignores
      body.identity_hint =
        'Keep the same main person (face, hair, body build) consistent across shots.';
    }
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Engine ${apiKeyIndex + 1} failed ${res.status}: ${text}`);
  }

  const json = await res.json();
  const remote: string | undefined =
    json.video?.url || json.url || json.data?.url || json.video_url;
  if (!remote) throw new Error('No video url in response');

  const local = `${FileSystem.documentDirectory}dream_${apiKeyIndex + 1}_${Date.now()}.mp4`;
  const dl = await FileSystem.downloadAsync(remote, local);

  const coverUrl = await extractVideoThumbnail(dl.uri).catch(() => null);

  return { videoUrl: dl.uri, coverUrl: coverUrl ?? null };
}

// ====== PUBLIC API ======

export async function generate3ClipDreamCinemaParallel(
  fullPrompt: string,
  localFaceImageUri?: string,
  onProgress?: (completed: number, total: number, step: string) => void
): Promise<{
  videoUrls: string[];
  stitchedVideoUrl: string;
  coverUrl: string | null;
  totalCost: number;
  generationTime: number;
}> {
  const start = Date.now();

  // Prepare identity as a DATA URL once
  let identityDataUrl: string | undefined;
  if (localFaceImageUri) {
    try {
      identityDataUrl = await getOrCreateIdentityImageUrl(localFaceImageUri);
      console.log('🪪 Identity prepared (data URL)');
    } catch (e) {
      console.warn('Identity prep failed; continuing without reference.', e);
    }
  }

  // 1) Split into acts
  onProgress?.(0, 3, 'Dream AI is analyzing your story...');
  const acts = await splitPromptInto3Acts(fullPrompt, !!identityDataUrl);
  onProgress?.(0, 3, 'Dream AI is creating your scenes...');

  // 2) Generate 3 clips in parallel
  const promises = acts.map((act, idx) =>
    generateSingleClip(act, idx, identityDataUrl, idx).then((r) => {
      onProgress?.(idx + 1, 3, `Dream sequence ${idx + 1}/3 ready`);
      return r;
    })
  );

  const results = await Promise.all(promises);
  const videoUrls = results.map((r) => r.videoUrl);
  const coverUrl = results[0]?.coverUrl ?? null;

  // 3) Stitch (native → cloud)
  onProgress?.(3, 3, 'Dream AI is finalizing your cinema...');
  let stitchedVideoUrl = videoUrls[0];
  try {
    stitchedVideoUrl = await stitchNative(videoUrls); // will throw → cloud fallback
    console.log('✅ [NATIVE] stitched');
  } catch {
    console.warn('Native stitch failed, using Cloudinary');
    stitchedVideoUrl = await stitchWithCloudinary(videoUrls, true);
    console.log('✅ [CLOUDINARY] stitched');
  }

  const generationTime = Date.now() - start;
  return {
    videoUrls,
    stitchedVideoUrl,
    coverUrl,
    totalCost: 0,
    generationTime,
  };
}

// ===== Splitter (OpenAI with fallback) =====

async function splitPromptInto3Acts(fullPrompt: string, hasFace: boolean): Promise<string[]> {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!key) {
    return [
      `${fullPrompt}. OPENING SCENE: Wide establishing cinematic shot introducing the environment and character with atmospheric lighting and mood.`,
      `${fullPrompt}. MAIN ACTION: Medium shot capturing the primary movement and story development with smooth camera work.`,
      `${fullPrompt}. CLIMAX MOMENT: Close-up emotional conclusion showing character reaction with dramatic depth of field and lighting.`,
    ];
  }

  try {
    const system = `Create 3 cinematic prompts for 6-second clips with continuity.
Include camera motion, lighting, environment, and realistic movement.
${hasFace ? 'Keep the SAME main person recognizable across acts.' : ''}

Return JSON: {"acts": ["act1", "act2", "act3"]}`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: fullPrompt },
        ],
        temperature: 0.7,
        max_tokens: 700,
      }),
    });

    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed.acts) && parsed.acts.length === 3) return parsed.acts;
    throw new Error('bad format');
  } catch {
    return [
      `${fullPrompt} - ESTABLISHING: Wide cinematic shot introducing the full dream scene with professional lighting and atmosphere.`,
      `${fullPrompt} - DEVELOPMENT: Medium shot capturing dynamic dream action with smooth camera movement and character focus.`,
      `${fullPrompt} - RESOLUTION: Close-up emotional dream moment with dramatic lighting and shallow depth of field.`,
    ];
  }
}

// Legacy wrapper
export async function generateVideoFal(
  prompt: string,
  _durationSeconds: number = 8,
  imageUri?: string
): Promise<{ videoUrl: string; coverUrl: string | null }> {
  const res = await generate3ClipDreamCinemaParallel(prompt, imageUri);
  return { videoUrl: res.stitchedVideoUrl, coverUrl: res.coverUrl };
}

export { extractVideoThumbnail };
