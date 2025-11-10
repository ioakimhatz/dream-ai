// app/utils/generateVideoFal.ts - HYBRID: Smart cleaning + Natural variations

import * as FileSystem from './fileSystem';
import { stitchNative } from './nativeStitch';
import { stitchWithCloudinary } from './cloudinaryStitch';
import { getOrCreateIdentityImageUrl } from './identityLock';
import { processPromptForGeneration } from './smartPromptProcessor';

type Engine = 'hailuo-02';
const ENGINE: Engine = 'hailuo-02';

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
      body.image_url = identityDataUrl;
    } else {
      body.reference_images = [identityDataUrl];
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

  // 🔥 STEP 1: Smart cleaning (removes explicit, celebrities)
  onProgress?.(0, 3, 'Dream AI is processing your story...');
  console.log('🧠 Smart cleaning prompt...');
  
  const processed = await processPromptForGeneration(fullPrompt);
  
  if (processed.isBlocked) {
    console.log(`🚫 Prompt blocked: ${processed.blockReason}`);
    throw new Error(`Your dream contains inappropriate content. Please try a different dream!`);
  }
  
  const cleanPrompt = processed.cleanPrompt || fullPrompt;
  console.log(`✅ Clean prompt: "${cleanPrompt}"`);

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

  // 🔥 STEP 2: Create natural variations using OpenAI (OLD SYSTEM RESTORED!)
  onProgress?.(0, 3, 'Dream AI is creating scene variations...');
  const acts = await splitPromptInto3NaturalActs(cleanPrompt, !!identityDataUrl);
  console.log('🎬 Natural variations:', acts);
  
  onProgress?.(0, 3, 'Dream AI is generating your scenes...');

  // 🔥 STEP 3: Generate 3 clips in parallel
  const promises = acts.map((act, idx) =>
    generateSingleClip(act, idx, identityDataUrl, idx).then((r) => {
      onProgress?.(idx + 1, 3, `Dream sequence ${idx + 1}/3 ready`);
      return r;
    })
  );

  const results = await Promise.all(promises);
  const videoUrls = results.map((r) => r.videoUrl);
  const coverUrl = results[0]?.coverUrl ?? null;

  // 🔥 STEP 4: Stitch (native → cloud)
  onProgress?.(3, 3, 'Dream AI is finalizing your cinema...');
  let stitchedVideoUrl = videoUrls[0];
  try {
    stitchedVideoUrl = await stitchNative(videoUrls);
    console.log('✅ [NATIVE] stitched');
  } catch {
    console.warn('Native stitch failed, using Cloudinary');
    stitchedVideoUrl = await stitchWithCloudinary(videoUrls);
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

/**
 * 🎯 RESTORED: OLD VARIATION SYSTEM
 * Uses OpenAI to create natural, cinematic variations
 * Falls back to simple descriptive variations if OpenAI unavailable
 */
async function splitPromptInto3NaturalActs(cleanPrompt: string, hasFace: boolean): Promise<string[]> {
  const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  
  // Fallback: Simple natural variations (no rigid templates!)
  if (!key) {
    console.log('⚠️ No OpenAI key, using simple variations');
    return [
      `${cleanPrompt}, wide establishing shot`,
      `${cleanPrompt}, medium shot with smooth motion`,
      `${cleanPrompt}, close-up emotional moment`,
    ];
  }

  try {
    const system = `You are a cinematic storytelling expert. Create 3 natural video prompts for 6-second clips.

CRITICAL RULES:
- Keep it SIMPLE and NATURAL (like describing a scene to a friend)
- NO technical terms (no "photorealistic", "4k", "cinematic", etc.)
- NO instructions (no "NOT cartoon", "NOT animated", etc.)
- Just describe WHAT happens in natural language
- Make each clip unique but tell one flowing story
- Each prompt should be 10-20 words maximum
${hasFace ? '- Keep the same main person consistent across all 3 clips' : ''}

INPUT: "${cleanPrompt}"

Create 3 simple, natural variations that tell a story:
- Clip 1: Opening/establishing scene
- Clip 2: Main action/movement  
- Clip 3: Emotional conclusion/reaction

Return JSON: {"acts": ["act1", "act2", "act3"]}

EXAMPLES:

Input: "person riding motorcycle with woman through forest"
Good Output:
{
  "acts": [
    "person and woman starting motorcycle ride at forest entrance",
    "person riding motorcycle with woman along winding forest path",
    "person and woman arriving at forest clearing, smiling"
  ]
}

Input: "person kissing woman in park"
Good Output:
{
  "acts": [
    "person and woman walking together in park",
    "person and woman sharing kiss under tree in park",
    "person and woman smiling after kiss in park"
  ]
}

Input: "two people playing with dog in park"
Good Output:
{
  "acts": [
    "dog running to greet two people in park",
    "two people throwing ball for dog in open field",
    "dog jumping happily with two people in park"
  ]
}`;

    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: cleanPrompt },
        ],
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    if (!r.ok) {
      console.warn('OpenAI failed, using fallback');
      throw new Error(await r.text());
    }
    
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    
    if (Array.isArray(parsed.acts) && parsed.acts.length === 3) {
      console.log('✅ OpenAI generated natural variations');
      return parsed.acts;
    }
    
    throw new Error('Invalid format from OpenAI');
    
  } catch (error) {
    console.warn('OpenAI variation failed, using fallback:', error);
    
    // Fallback: Simple natural variations
    return [
      `${cleanPrompt}, wide establishing shot`,
      `${cleanPrompt}, medium shot with smooth motion`,
      `${cleanPrompt}, close-up emotional moment`,
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