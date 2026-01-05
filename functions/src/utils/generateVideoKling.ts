// functions/src/utils/generateVideoKling.ts - HYBRID: Smart cleaning + Scene chaining + Optional faces
import * as FileSystem from "./fileSystem";
import { getScenePlan } from "./enhancePrompt";
import { stitchWithCloudinary, uploadImage } from "./cloudinaryStitch";
import { generateSceneImage } from "./sceneImageGenerator";
import { addAudioToVideo } from "./addAudioToVideo";
import { processPromptForGeneration } from "./smartPromptProcessor";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import * as fs from 'fs';

// 🔥 Duration constants for different clip types
const DURATION_SHORT = "5" as "5";   // 5 seconds - for ending clips
const DURATION_MEDIUM = "10" as "10"; // 10 seconds - for main action clips
const DURATION = DURATION_SHORT;      // Default for backward compatibility

const CFG = 0.5;
const USE_SCENE_IMAGE_GEN = process.env.EXPO_PUBLIC_USE_SCENE_IMAGE_GEN === "1";
const ENABLE_AUDIO = process.env.EXPO_PUBLIC_ENABLE_AUDIO === "1";
const MAX_RETRIES = 2;

const KLING_NEGATIVE_PROMPT =
  "blur, distort, low quality, warping, morphing, artifacts, " +
  "flickering, choppy motion, face distortion, unnatural physics";

// Set FFmpeg path for frame extraction
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

/**
 * Extracts the last frame from a video as a JPEG image and uploads to Cloudinary
 * @param videoPath Local path to the video file
 * @returns Cloudinary URL of the uploaded image
 */
async function extractLastFrameAsImage(videoPath: string): Promise<string> {
  console.log('📸 Extracting last frame from:', videoPath);

  // Extract last frame using FFmpeg
  await new Promise<void>((resolve, reject) => {
    ffmpeg(videoPath)
      .screenshots({
        count: 1,
        filename: 'lastframe.jpg',
        folder: '/tmp/dream-ai',
        timemarks: ['99%'] // Extract from 99% of video duration (near end)
      })
      .on('end', () => {
        console.log('✅ Last frame extracted');
        resolve();
      })
      .on('error', (err) => {
        console.error('❌ FFmpeg frame extraction error:', err);
        reject(err);
      });
  });

  const extractedFramePath = '/tmp/dream-ai/lastframe.jpg';

  // Verify the file was created
  if (!fs.existsSync(extractedFramePath)) {
    throw new Error('Frame extraction failed - file not created');
  }

  console.log('☁️ Uploading last frame to Cloudinary...');
  const lastFrameImageUrl = await uploadImage(extractedFramePath);
  console.log('✅ Last frame uploaded:', lastFrameImageUrl);

  // Clean up the extracted frame
  try {
    fs.unlinkSync(extractedFramePath);
  } catch (err) {
    console.warn('⚠️ Failed to cleanup extracted frame:', err);
  }

  return lastFrameImageUrl;
}

function falKey(): string {
  const k =
    process.env.EXPO_PUBLIC_FAL_API_KEY_1 ||
    process.env.EXPO_PUBLIC_FAL_API_KEY ||
    process.env.EXPO_PUBLIC_FAL_KEY;
  if (!k) throw new Error("Missing FAL API key");
  return k;
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`🔄 [${operationName}] Attempt ${attempt}/${maxRetries + 1}`);
      return await operation();
    } catch (error: any) {
      lastError = error;
      console.error(`❌ [${operationName}] Attempt ${attempt} failed:`, error);
      
      const errorMsg = `${error?.message || error}`.toLowerCase();
      
      if (
        errorMsg.includes('content_rejected_by_api') ||
        errorMsg.includes('unauthorized') || 
        errorMsg.includes('api key') || 
        errorMsg.includes('forbidden')
      ) {
        console.log(`⚠️ Non-retryable error detected, stopping immediately`);
        throw error;
      }
      
      if (attempt <= maxRetries) {
        const delayMs = Math.min(2000 * attempt, 5000);
        console.log(`⏳ Retrying ${operationName} in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError;
}

async function extractVideoThumbnail(videoUri: string): Promise<string | null> {
  // Cloud Functions doesn't support video thumbnails
  return null;
}

/**
 * 🧠 GPT-Powered Prompt Analysis
 *
 * Analyzes prompt to determine:
 * 1. Should it be POV? (immersion)
 * 2. Is it specific or abstract? (consistency vs variety)
 *
 * Cost: ~$0.0001 per analysis (negligible)
 */
async function analyzePromptWithGPT(prompt: string, openaiKey: string): Promise<{
  shouldBePOV: boolean;
  contentType: 'specific' | 'abstract';
  reasoning: string;
}> {
  const promptLower = prompt.toLowerCase();

  // Check if already has POV
  const alreadyHasPOV = promptLower.includes('pov') ||
                        promptLower.includes('first person') ||
                        promptLower.includes('first-person');

  const systemPrompt = `You are an expert at analyzing dream descriptions for video generation.

Analyze the prompt and answer TWO questions:

1. **Should this be FIRST-PERSON POV?**
   - YES for: Vehicles (car, motorcycle, plane), activities (skiing, driving, flying), environments
   - NO for: Animals (ANY animal), creatures (dragon, monster, alien), characters being watched
   - Reason: POV = user EXPERIENCES it. Third-person = user WATCHES it.

2. **Is this SPECIFIC or ABSTRACT content?**
   - SPECIFIC: Has a specific object/character that must stay consistent across clips
     * Examples: "dog", "red Ferrari", "dragon", "Godzilla", "person", specific vehicle/animal/creature
     * Needs: Same object in both clips (consistency critical)

   - ABSTRACT: Environmental, conceptual, or camera-based experiences
     * Examples: "floating through clouds", "flying through space", "underwater journey", "POV through tunnel"
     * Allows: Different angles/perspectives (variety is good)

EXAMPLES:

Input: "red Ferrari racing through city"
Output: {
  "shouldBePOV": true,
  "contentType": "specific",
  "reasoning": "Vehicle (Ferrari) should be POV for immersion. Specific car that must stay consistent (same red Ferrari in both clips)."
}

Input: "golden retriever flying over ocean"
Output: {
  "shouldBePOV": false,
  "contentType": "specific",
  "reasoning": "Animal (dog) should be third-person (watch it). Specific dog that must stay consistent (same golden retriever in both clips)."
}

Input: "POV floating through clouds"
Output: {
  "shouldBePOV": false,
  "contentType": "abstract",
  "reasoning": "Already has POV (don't add again). Abstract environment - clouds can vary between clips for dynamic cinematography."
}

Input: "dragon landing on mountain"
Output: {
  "shouldBePOV": false,
  "contentType": "specific",
  "reasoning": "Creature (dragon) should be third-person (watch it). Specific dragon that must stay consistent (same dragon in both clips)."
}

Input: "motorcycle through Tokyo at night"
Output: {
  "shouldBePOV": true,
  "contentType": "specific",
  "reasoning": "Vehicle (motorcycle) should be POV for immersion. Specific bike that must stay consistent (same motorcycle in both clips)."
}

Input: "underwater journey through coral reef"
Output: {
  "shouldBePOV": true,
  "contentType": "abstract",
  "reasoning": "Environmental journey should be POV for immersion. Abstract environment - coral can vary for dynamic scenes."
}

Return JSON only:
{
  "shouldBePOV": true/false,
  "contentType": "specific" or "abstract",
  "reasoning": "brief explanation"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cheap and fast!
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this dream prompt: "${prompt}"` }
        ],
        temperature: 0.3, // Low temp for consistent decisions
        max_tokens: 150
      })
    });

    if (!response.ok) {
      console.warn('⚠️ GPT analysis failed, using fallback logic');
      return {
        shouldBePOV: false,
        contentType: 'abstract',
        reasoning: 'Analysis failed - using safe defaults'
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    // Override shouldBePOV if already has POV
    const finalShouldBePOV = alreadyHasPOV ? false : (parsed.shouldBePOV || false);

    console.log('🧠 GPT ANALYSIS:');
    console.log(`   POV: ${finalShouldBePOV ? 'CONVERT TO POV' : 'KEEP THIRD-PERSON'}`);
    console.log(`   Type: ${parsed.contentType?.toUpperCase() || 'ABSTRACT'}`);
    console.log(`   Reasoning: ${parsed.reasoning}`);

    return {
      shouldBePOV: finalShouldBePOV,
      contentType: parsed.contentType || 'abstract',
      reasoning: parsed.reasoning || 'No reasoning provided'
    };

  } catch (error) {
    console.error('❌ Error in GPT analysis:', error);
    return {
      shouldBePOV: false,
      contentType: 'abstract',
      reasoning: 'Error in analysis - using safe defaults'
    };
  }
}

async function klingI2V(prompt: string, imageUrl: string): Promise<{ localUri: string; coverUrl: string | null }> {
  const endpoint = "https://fal.run/fal-ai/kling-video/v2.6/pro/image-to-video";

  console.log(`🎬 Generating Kling video with prompt: "${prompt}"`);

  const body: any = {
    prompt: prompt,
    image_url: imageUrl,
    duration: DURATION,
    cfg_scale: CFG,
    aspect_ratio: "9:16",
    generate_audio: false,  // ✅ FIXED: Correct parameter name (saves 50% cost)
    negative_prompt: KLING_NEGATIVE_PROMPT,
  };

  const r = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Key ${falKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errorText = await r.text();
    console.error("❌ Kling API Error:", r.status, errorText);

    const errorLower = errorText.toLowerCase();
    if (
      r.status === 400 ||
      r.status === 403 ||
      errorLower.includes("content") ||
      errorLower.includes("policy") ||
      errorLower.includes("inappropriate") ||
      errorLower.includes("safety") ||
      errorLower.includes("nsfw") ||
      errorLower.includes("violat") ||
      errorLower.includes("forbidden") ||
      errorLower.includes("blocked") ||
      errorLower.includes("rejected")
    ) {
      console.error("🚫 Content rejected by Kling - STOPPING to prevent more charges");
      throw new Error("CONTENT_REJECTED_BY_API");
    }

    throw new Error(`Kling i2v ${r.status}: ${errorText}`);
  }

  const j = await r.json();
  const remote = j?.video?.url || j?.url;
  if (!remote) throw new Error("Kling i2v: no video URL in response");

  const out = `${FileSystem.documentDirectory}kling_i2v_${Date.now()}.mp4`;
  const dl = await FileSystem.downloadAsync(remote, out);
  const coverUrl = await extractVideoThumbnail(dl.uri).catch(() => null);
  return { localUri: dl.uri, coverUrl: coverUrl ?? null };
}

// 🔥 NEW: Kling Text-to-Video for Dreamcore (no Nano Banana needed!)
async function klingTextToVideo(prompt: string): Promise<{ localUri: string; coverUrl: string | null }> {
  const endpoint = "https://fal.run/fal-ai/kling-video/v2.6/pro/text-to-video";

  console.log(`🎬 [Dreamcore Path] Generating Kling video from text: "${prompt}"`);

  const body: any = {
    prompt: prompt,
    duration: DURATION,
    cfg_scale: CFG,
    aspect_ratio: "9:16",
    generate_audio: false,  // ✅ FIXED: Correct parameter name (saves 50% cost)
    negative_prompt: KLING_NEGATIVE_PROMPT,
  };

  const r = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Key ${falKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errorText = await r.text();
    console.error("❌ Kling Text-to-Video API Error:", r.status, errorText);

    const errorLower = errorText.toLowerCase();
    if (
      r.status === 400 ||
      r.status === 403 ||
      errorLower.includes("content") ||
      errorLower.includes("policy") ||
      errorLower.includes("inappropriate") ||
      errorLower.includes("safety") ||
      errorLower.includes("nsfw") ||
      errorLower.includes("violat") ||
      errorLower.includes("forbidden") ||
      errorLower.includes("blocked") ||
      errorLower.includes("rejected")
    ) {
      console.error("🚫 Content rejected by Kling - STOPPING to prevent more charges");
      throw new Error("CONTENT_REJECTED_BY_API");
    }

    throw new Error(`Kling text-to-video ${r.status}: ${errorText}`);
  }

  const j = await r.json();
  const remote = j?.video?.url || j?.url;
  if (!remote) throw new Error("Kling text-to-video: no video URL in response");

  const out = `${FileSystem.documentDirectory}kling_t2v_${Date.now()}.mp4`;
  const dl = await FileSystem.downloadAsync(remote, out);
  const coverUrl = await extractVideoThumbnail(dl.uri).catch(() => null);

  console.log(`✅ [Dreamcore] Video generated: ${dl.uri}`);
  return { localUri: dl.uri, coverUrl: coverUrl ?? null };
}

// 🔥 NEW: Kling Text-to-Video 10s for Main Dreamcore Clip with Last Frame Extraction
async function klingTextToVideo10s(prompt: string): Promise<{
  localUri: string;
  coverUrl: string | null;
  lastFrameUrl: string | null; // For consistency chaining
}> {
  const endpoint = "https://fal.run/fal-ai/kling-video/v2.6/pro/text-to-video";

  console.log(`🎬 [10s Dreamcore] Generating from text: "${prompt}"`);

  const body: any = {
    prompt: prompt,
    duration: DURATION_MEDIUM, // 🔥 10 seconds!
    cfg_scale: CFG,
    aspect_ratio: "9:16",
    generate_audio: false,  // ✅ FIXED: Correct parameter name (saves 50% cost)
    negative_prompt: KLING_NEGATIVE_PROMPT,
  };

  const r = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Key ${falKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    const errorText = await r.text();
    console.error("❌ Kling 10s Text-to-Video API Error:", r.status, errorText);

    const errorLower = errorText.toLowerCase();
    if (
      r.status === 400 ||
      r.status === 403 ||
      errorLower.includes("content") ||
      errorLower.includes("policy") ||
      errorLower.includes("inappropriate") ||
      errorLower.includes("safety") ||
      errorLower.includes("nsfw") ||
      errorLower.includes("violat") ||
      errorLower.includes("forbidden") ||
      errorLower.includes("blocked") ||
      errorLower.includes("rejected")
    ) {
      console.error("🚫 Content rejected by Kling - STOPPING to prevent more charges");
      throw new Error("CONTENT_REJECTED_BY_API");
    }

    throw new Error(`Kling 10s text-to-video ${r.status}: ${errorText}`);
  }

  const j = await r.json();
  const remote = j?.video?.url || j?.url;
  if (!remote) throw new Error("Kling 10s text-to-video: no video URL in response");

  const out = `${FileSystem.documentDirectory}kling_t2v_10s_${Date.now()}.mp4`;
  const dl = await FileSystem.downloadAsync(remote, out);
  const coverUrl = await extractVideoThumbnail(dl.uri).catch(() => null);

  console.log(`✅ [10s Dreamcore] Video generated: ${dl.uri}`);

  // 🔥 CRITICAL: Extract last frame from 10s clip for consistency chaining
  // The Kling API response may include the last frame URL directly
  let lastFrameUrl: string | null = null;

  try {
    // Check if Kling API returns end_frame_url (some APIs do)
    if (j?.end_frame_url) {
      lastFrameUrl = j.end_frame_url;
      console.log(`✅ Last frame URL from API: ${lastFrameUrl}`);
    } else if (j?.video?.end_frame) {
      lastFrameUrl = j.video.end_frame;
      console.log(`✅ Last frame URL from API: ${lastFrameUrl}`);
    } else {
      // ✅ FIX: Extract last frame as IMAGE (not video URL)
      // Kling i2v expects a JPEG/PNG image, not a video file
      console.log('📸 API did not provide last frame - extracting from video...');
      lastFrameUrl = await extractLastFrameAsImage(dl.uri);
      console.log(`✅ Last frame extracted and uploaded: ${lastFrameUrl}`);
    }
  } catch (error) {
    console.error('❌ Failed to extract last frame as image:', error);
    // Fallback: try with video URL (may still fail with 10MB error)
    console.warn('⚠️ Falling back to video URL (may exceed 10MB limit)');
    lastFrameUrl = remote;
  }

  return {
    localUri: dl.uri,
    coverUrl: coverUrl ?? null,
    lastFrameUrl
  };
}

async function uploadVideoToCloudinary(localUri: string): Promise<string> {
  const CLOUD = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

  if (!CLOUD || !PRESET) throw new Error("Missing Cloudinary env vars.");

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD}/video/upload`;
  
  // Read file content
  const fileData = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' });
  const blob = Buffer.from(fileData, 'base64');
  
  const form = new FormData();
  form.append("upload_preset", PRESET);
  form.append("file", new Blob([blob], { type: "video/mp4" }), "clip.mp4");

  const res = await fetch(endpoint, { method: "POST", body: form as any });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudinary upload failed ${res.status}: ${text}`);
  }
  const json = await res.json();
  
  return json.secure_url;
}

// 🔥 NEW: 2-Clip Dreamcore Path (10s + 5s) with Smart Consistency
async function generate2ClipDreamcore(
  cleanPrompt: string,
  onProgress?: (done: number, total: number, step: string) => void
): Promise<{
  videoUrls: string[];
  stitchedVideoUrl: string;
  coverUrl: string | null;
  thumbnailUrl: string | null;
  totalCost: number;
  generationTime: number;
}> {
  const t0 = Date.now();

  console.log('🌀 [DREAMCORE PATH] 10s + 5s generation with smart consistency');

  // STEP 1: 🧠 Intelligent prompt analysis with GPT-4o-mini
  onProgress?.(0, 7, "Analyzing prompt...");

  const openaiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error("OpenAI API key required");
  }

  const analysis = await analyzePromptWithGPT(cleanPrompt, openaiKey);
  console.log(`🧠 GPT Analysis: shouldBePOV=${analysis.shouldBePOV}, contentType=${analysis.contentType}`);
  console.log(`💭 Reasoning: ${analysis.reasoning}`);

  // Apply POV conversion if needed
  let finalPrompt = cleanPrompt;
  if (analysis.shouldBePOV) {
    finalPrompt = `first-person POV ${cleanPrompt}`;
    console.log('✅ Converting to POV for immersion');
  } else {
    console.log('ℹ️ Keeping third-person perspective');
  }

  // STEP 2: Cinematic enhancement (2 prompts: 10s + 5s)
  const { enhanceDreamcorePrompt } = await import("./enhancePrompt");

  onProgress?.(1, 7, "Creating cinematic plan (10s + 5s)...");

  const plan = await retryOperation(
    () => enhanceDreamcorePrompt(finalPrompt),
    "Cinematic 2-Clip Planning (GPT-4o)"
  ).catch((error) => {
    throw new Error(`Cinematic scene planning failed: ${error.message}`);
  });

  console.log('📝 10s prompt:', plan.act1);
  console.log('📝 5s prompt:', plan.act2);

  // STEP 3: Generate 10s clip (main action)
  onProgress?.(2, 7, "Generating main clip (10s)...");

  const clip1 = await retryOperation(
    () => klingTextToVideo10s(plan.act1),
    "Kling 10s Text-to-Video"
  ).catch((error: any) => {
    if (error.message === "CONTENT_REJECTED_BY_API") {
      throw new Error("Content not allowed by AI service. Please try a different dream.");
    }
    throw new Error(`10s clip generation failed: ${error.message}`);
  });

  console.log('✅ 10s clip generated');
  console.log(`📸 Last frame URL: ${clip1.lastFrameUrl ? 'Available' : 'Not available'}`);

  // Save last frame for thumbnail
  const thumbnailUrl = clip1.lastFrameUrl;

  // STEP 4: Generate 5s clip (ending) - method depends on content type
  onProgress?.(3, 7, "Generating ending clip (5s)...");

  let clip2;

  if (analysis.contentType === 'specific' && clip1.lastFrameUrl) {
    // 🎯 SPECIFIC content: Use last frame for perfect consistency
    console.log('🎯 [SPECIFIC] Using last frame from clip 1 for consistency (same object)');

    clip2 = await retryOperation(
      () => klingI2V(plan.act2, clip1.lastFrameUrl!),
      "Kling 5s Image-to-Video (Consistency)"
    ).catch((error: any) => {
      if (error.message === "CONTENT_REJECTED_BY_API") {
        throw new Error("Content not allowed by AI service. Please try a different dream.");
      }
      throw new Error(`5s clip generation failed: ${error.message}`);
    });

    console.log('✅ 5s clip generated using last frame (perfect consistency!)');
  } else {
    // 🌀 ABSTRACT content: Use text-to-video for variety
    console.log('🌀 [ABSTRACT] Using text-to-video for dynamic variety (POV/environment)');

    clip2 = await retryOperation(
      () => klingTextToVideo(plan.act2),
      "Kling 5s Text-to-Video (Variety)"
    ).catch((error: any) => {
      if (error.message === "CONTENT_REJECTED_BY_API") {
        throw new Error("Content not allowed by AI service. Please try a different dream.");
      }
      throw new Error(`5s clip generation failed: ${error.message}`);
    });

    console.log('✅ 5s clip generated with dynamic variety');
  }

  let localClips = [clip1.localUri, clip2.localUri];

  // Use clip1's cover as thumbnail (if available)
  const coverUrl = clip1.coverUrl;
  console.log(`🖼️ Using clip 1 cover as thumbnail: ${coverUrl ? 'Yes' : 'No'}`);

  console.log("✅ Both clips generated (10s + 5s = 15s total)");

  // STEP 5: Optional Audio Enhancement
  if (ENABLE_AUDIO) {
    console.log("🎵 Starting audio enhancement...");
    console.log("⚠️ WARNING: This adds cost per clip");
    onProgress?.(4, 7, "Adding sound effects...");

    const audioEnhancedClips: string[] = [];
    let audioSuccessCount = 0;

    const prompts = [plan.act1, plan.act2];
    const durations = [10, 5]; // 10s for clip 1, 5s for clip 2

    for (let i = 0; i < localClips.length; i++) {
      try {
        console.log(`🎵 Processing audio for clip ${i + 1}/2 (${durations[i]}s)...`);

        const publicUrl = await retryOperation(
          () => uploadVideoToCloudinary(localClips[i]),
          `Cloudinary Upload ${i + 1}/2`,
          1
        );
        console.log(`✅ Uploaded to Cloudinary: ${publicUrl}`);

        const enhancedVideo = await retryOperation(
          () => addAudioToVideo(publicUrl, prompts[i], durations[i]),
          `Mirelo Audio ${i + 1}/2`,
          1
        );

        audioEnhancedClips.push(enhancedVideo);
        audioSuccessCount++;
        console.log(`✅ Audio added to clip ${i + 1}/2`);

      } catch (error) {
        console.error(`⚠️ Failed to add audio to clip ${i + 1}:`, error);
        console.log(`ℹ️ Continuing with clip ${i + 1} without audio`);
        audioEnhancedClips.push(localClips[i]);
      }
    }

    localClips = audioEnhancedClips;
    console.log(`✅ Audio complete (${audioSuccessCount}/2 clips with audio)`);
  } else {
    console.log("ℹ️ Audio disabled");
  }

  // STEP 6: Stitch videos (10s + 5s = 15s total)
  onProgress?.(5, 7, "Stitching clips (15s total)...");
  let stitchedVideoUrl = localClips[0];

  try {
    stitchedVideoUrl = await retryOperation(
      () => stitchWithCloudinary(localClips),
      "Video Stitching"
    );
    console.log("✅ Stitched successfully (15s final video)");
  } catch (e) {
    console.warn("⚠️ Stitch failed, returning first clip:", e);
  }

  const dt = Date.now() - t0;

  // Cost calculation
  const kling10sCost = 0.60; // Approximate cost for 10s clip
  const kling5sCost = 0.30;  // Cost for 5s clip
  const audioCost = ENABLE_AUDIO ? (0.007 * 15) : 0; // 15 seconds total
  const sceneImageCost = 0; // 🔥 No Nano Banana = $0.15 saved!

  const totalCost = kling10sCost + kling5sCost + sceneImageCost + audioCost;

  console.log(`💰 Total cost: $${totalCost.toFixed(2)}`);
  console.log(`   - 10s clip: $${kling10sCost.toFixed(2)}`);
  console.log(`   - 5s clip: $${kling5sCost.toFixed(2)}`);
  console.log(`   - Saved (no Nano Banana): $0.15`);
  console.log(`   - Audio: $${audioCost.toFixed(2)}`);
  console.log(`⏱️ Generation time: ${(dt / 1000).toFixed(1)}s`);

  return {
    videoUrls: localClips,
    stitchedVideoUrl,
    coverUrl,
    thumbnailUrl,
    totalCost,
    generationTime: dt,
  };
}

export async function generate3ClipKlingParallel(
  rawPrompt: string,
  localFaceImageUris?: string | string[],
  onProgress?: (done: number, total: number, step: string) => void
): Promise<{
  videoUrls: string[];
  stitchedVideoUrl: string;
  coverUrl: string | null;
  thumbnailUrl?: string | null;
  totalCost: number;
  generationTime: number;
}> {
  const t0 = Date.now();

  // ✅ Check if scene image generation is enabled
  if (!USE_SCENE_IMAGE_GEN) {
    throw new Error("Scene image generation is disabled. Enable EXPO_PUBLIC_USE_SCENE_IMAGE_GEN=1");
  }

  // ✅ Face images are OPTIONAL - can be undefined or empty array!
  const faceUris = localFaceImageUris
    ? (Array.isArray(localFaceImageUris) ? localFaceImageUris : [localFaceImageUris])
    : undefined;

  console.log(`👥 Generating with ${faceUris?.length || 0} character(s)`);

  // STEP 1: Smart cleaning
  console.log('🧠 Smart cleaning prompt...');
  const processed = await retryOperation(
    () => processPromptForGeneration(rawPrompt),
    "Smart Prompt Processing"
  ).catch((error) => {
    throw new Error(`Prompt processing failed: ${error.message}`);
  });

  if (processed.isBlocked) {
    console.log(`🚫 Prompt blocked: ${processed.blockReason}`);
    throw new Error(`Your dream contains inappropriate content. Please try a different dream!`);
  }

  const cleanPrompt = processed.cleanPrompt || "person in a dream scene";
  console.log(`✅ Clean prompt: "${cleanPrompt}"`);

  // STEP 2: Scene planning
  const plan = await retryOperation(
    () => getScenePlan(cleanPrompt),
    "Scene Planning"
  ).catch((error) => {
    throw new Error(`Scene planning failed: ${error.message}`);
  });

  console.log("📝 Base:", plan.basePrompt);
  console.log("🎬 Natural variations:", plan.acts);

  // 🔥 ROUTING LOGIC: Check if user uploaded faces
  const hasFaces = faceUris && faceUris.length > 0;

  if (!hasFaces) {
    // 🌀 PATH B: DREAMCORE - No faces, use 10s + 5s with smart consistency!
    console.log('🌀 [ROUTING] No faces detected → DREAMCORE PATH (10s + 5s)');
    console.log('✨ BENEFITS:');
    console.log('   - Skipping Nano Banana saves $0.15');
    console.log('   - 10s main clip + 5s ending = 15s total');
    console.log('   - GPT-4o for cinematic prompts');
    console.log('   - Smart consistency for specific objects');
    return await generate2ClipDreamcore(cleanPrompt, onProgress);
  }

  // 👤 PATH A: FACES - Keep existing pipeline with Nano Banana
  console.log('👤 [ROUTING] Faces detected → STANDARD PATH (image-to-video with faces)');
  console.log(`📸 Using ${faceUris.length} face image(s) for character consistency`);

  // STEP 3: Generate scene images with Nano Banana (WITH SCENE CHAINING!)
  onProgress?.(0, 9, "Creating scenes...");
  const sceneImages: string[] = [];
  let establishingImage: string | undefined;
  
  for (let i = 0; i < plan.acts.length; i++) {
    onProgress?.(i + 1, 9, `Scene ${i + 1}/3...`);
    
    try {
      const useBaseImage = i > 0 && establishingImage;
      
      if (useBaseImage) {
        console.log(`🔗 [Scene ${i + 1}] Using Scene 1 as base for perfect consistency`);
      } else {
        console.log(`🎨 [Scene ${i + 1}] Generating ${faceUris?.length ? 'with faces' : 'from prompt'}`);
      }

      // ✅ CRITICAL: Use SHORT Nano Banana prompts for image generation
      const imagePrompt = plan.nanoBananaPrompts?.[i] || plan.acts[i];
      console.log(`📝 Image gen prompt (${imagePrompt.split(' ').length} words):`, imagePrompt);

      const sceneImage = await retryOperation(
        () => generateSceneImage(
          faceUris,  // ✅ Can be undefined!
          imagePrompt,  // ✅ CHANGED: Use Nano Banana prompt (SHORT)
          useBaseImage ? establishingImage : undefined
        ),
        `Scene Image ${i + 1}/3`,
        1
      );
      
      sceneImages.push(sceneImage);
      
      if (i === 0) {
        establishingImage = sceneImage;
        console.log(`✅ Scene 1 locked as establishing shot`);
      } else {
        console.log(`✅ Scene ${i + 1}/3 ready with consistency`);
      }
      
    } catch (error: any) {
      if (error.message === "CONTENT_REJECTED_BY_API") {
        console.error(`🚫 Scene ${i + 1} rejected - STOPPING`);
        throw new Error("Content not allowed by AI service. Please try a different dream.");
      }
      throw error;
    }
    
    if (i < plan.acts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log("✅ All 3 scenes ready!");

  // STEP 4: Animate with Kling
  onProgress?.(3, 9, "Animating...");

  // ✅ CRITICAL: Use RICH Kling prompts for video generation
  const videoPrompts = plan.klingPrompts || plan.acts;
  console.log("🎬 Using RICH Kling prompts for video animation");

  const jobs = videoPrompts.map((videoPrompt, i) => {
    console.log(`📝 Video gen prompt (${videoPrompt.split(' ').length} words):`, videoPrompt);
    return retryOperation(
      () => klingI2V(videoPrompt, sceneImages[i]),  // ✅ CHANGED: Use Kling prompt (RICH)
      `Kling Video ${i + 1}/3`
    ).then((r) => {
      onProgress?.(4 + i, 9, `Video ${i + 1}/3...`);
      return r;
    }).catch((error: any) => {
      console.error(`❌ Failed to generate video ${i + 1}/3:`, error);

      if (error.message === "CONTENT_REJECTED_BY_API") {
        console.error(`🚫 Video ${i + 1} rejected - STOPPING`);
        throw new Error("CONTENT_REJECTED_BY_KLING");
      }

      throw new Error(`Video generation failed for scene ${i + 1}: ${error.message}`);
    });
  });
  
  let results;
  try {
    results = await Promise.all(jobs);
  } catch (error: any) {
    if (error.message === "CONTENT_REJECTED_BY_KLING") {
      throw new Error("Content not allowed by AI service. Please try a different dream.");
    }
    throw error;
  }
  
  let localClips = results.map((r) => r.localUri);

  // 🔥 FIX: Use first scene image as thumbnail instead of extracting from video
  const coverUrl = sceneImages[0] || null;
  console.log(`🖼️ Using first scene image as thumbnail: ${coverUrl}`);

  console.log("✅ All 3 Kling videos generated");

  // STEP 5: Audio (Optional)
  if (ENABLE_AUDIO) {
    console.log("🎵 Starting audio enhancement...");
    console.log("⚠️ WARNING: This adds $0.23 per clip ($0.69 total)");
    onProgress?.(7, 9, "Adding sound effects...");
    
    const audioEnhancedClips: string[] = [];
    let audioSuccessCount = 0;
    
    for (let i = 0; i < localClips.length; i++) {
      try {
        console.log(`🎵 Processing audio for clip ${i + 1}/3...`);
        
        const publicUrl = await retryOperation(
          () => uploadVideoToCloudinary(localClips[i]),
          `Cloudinary Upload ${i + 1}/3`,
          1
        );
        console.log(`✅ Uploaded to Cloudinary: ${publicUrl}`);
        
        const enhancedVideo = await retryOperation(
          () => addAudioToVideo(publicUrl, plan.acts[i], 5),
          `Mirelo Audio ${i + 1}/3`,
          1
        );
        
        audioEnhancedClips.push(enhancedVideo);
        audioSuccessCount++;
        console.log(`✅ Audio added to clip ${i + 1}/3`);
        
        onProgress?.(7 + i / 3, 9, `Audio ${i + 1}/3...`);
        
      } catch (error) {
        console.error(`⚠️ Failed to add audio to clip ${i + 1}:`, error);
        console.log(`ℹ️ Continuing with clip ${i + 1} without audio`);
        audioEnhancedClips.push(localClips[i]);
      }
    }
    
    localClips = audioEnhancedClips;
    console.log(`✅ Audio complete (${audioSuccessCount}/3 clips with audio)`);
  } else {
    console.log("ℹ️ Audio disabled (saves $0.69 per generation)");
  }

  // STEP 6: Stitch videos
  onProgress?.(8, 9, "Stitching...");
  let stitchedVideoUrl = localClips[0];
  
  try {
    stitchedVideoUrl = await retryOperation(
  () => stitchWithCloudinary(localClips),  // ✅ Returns Cloudinary URL
  "Video Stitching"
   );
    console.log("✅ Stitched successfully");
  } catch (e) {
    console.warn("⚠️ Stitch failed, returning first clip:", e);
  }

  const dt = Date.now() - t0;
  const per5s = Number(process.env.EXPO_PUBLIC_KLING_PRICE_PER5S || 0.30);
  const audioPerSec = 0.007;
  const audioCost = ENABLE_AUDIO ? (audioPerSec * 5 * 3) : 0;
  const sceneImageCost = 0.05 * 3;
  const totalCost = (per5s * 3) + sceneImageCost + audioCost;

  console.log(`💰 Total cost: $${totalCost.toFixed(2)} (audio: ${ENABLE_AUDIO ? 'YES' : 'NO'})`);
  console.log(`⏱️ Generation time: ${(dt / 1000).toFixed(1)}s`);

  return {
    videoUrls: localClips,
    stitchedVideoUrl,
    coverUrl,
    thumbnailUrl: coverUrl, // Use first scene image as thumbnail
    totalCost,
    generationTime: dt,
  };
}

export default {};