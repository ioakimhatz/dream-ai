// app/utils/generateVideoKling.ts - FINAL VERSION
import * as FileSystem from "expo-file-system";
import { getScenePlan } from "./enhancePrompt";
import { stitchWithCloudinary, uploadImage } from "./cloudinaryStitch";
import { generateSceneImage } from "./sceneImageGenerator";
import { addAudioToVideo } from "./addAudioToVideo";

const DURATION = "5" as "5";
const CFG = 0.5;
const USE_SCENE_IMAGE_GEN = process.env.EXPO_PUBLIC_USE_SCENE_IMAGE_GEN === "1";
const ENABLE_AUDIO = process.env.EXPO_PUBLIC_ENABLE_AUDIO !== "0";
const MAX_RETRIES = 2;

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
      
      if (errorMsg.includes('unauthorized') || errorMsg.includes('api key') || errorMsg.includes('forbidden')) {
        console.log(`⚠️ Auth/config error detected, not retrying`);
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
  try {
    const VideoThumbnails = await import("expo-video-thumbnails").catch(() => null);
    if (!VideoThumbnails) return null;
    const { uri } = await (VideoThumbnails as any).getThumbnailAsync(videoUri, { time: 700, quality: 0.8 });
    return uri ?? null;
  } catch {
    return null;
  }
}

async function klingI2V(prompt: string, imageUrl: string): Promise<{ localUri: string; coverUrl: string | null }> {
  const endpoint = "https://fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
  const body: any = {
    prompt: prompt,
    image_url: imageUrl,
    duration: DURATION,
    cfg_scale: CFG,
    negative_prompt: "blur, distort, low quality, artifacts",
  };

  const r = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Key ${falKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  
  if (!r.ok) {
    const errorText = await r.text();
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

async function uploadVideoToCloudinary(localUri: string): Promise<string> {
  const CLOUD = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!;
  const PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

  if (!CLOUD || !PRESET) throw new Error("Missing Cloudinary env vars.");

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD}/video/upload`;
  const form = new FormData();
  form.append("upload_preset", PRESET);
  form.append("file", { uri: localUri, name: "clip.mp4", type: "video/mp4" } as any);

  const res = await fetch(endpoint, { method: "POST", body: form as any });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudinary upload failed ${res.status}: ${text}`);
  }
  const json = await res.json();
  
  return json.secure_url;
}

export async function generate3ClipKlingParallel(
  rawPrompt: string,
  localFaceImageUris?: string | string[],
  onProgress?: (done: number, total: number, step: string) => void
): Promise<{
  videoUrls: string[];
  stitchedVideoUrl: string;
  coverUrl: string | null;
  totalCost: number;
  generationTime: number;
}> {
  const t0 = Date.now();

  const faceUris = localFaceImageUris 
    ? (Array.isArray(localFaceImageUris) ? localFaceImageUris : [localFaceImageUris])
    : undefined;

  if (!faceUris || !USE_SCENE_IMAGE_GEN) {
    throw new Error("Scene image generation required");
  }

  console.log(`👥 Generating with ${faceUris.length} character(s)`);

  const plan = await retryOperation(
    () => getScenePlan(rawPrompt),
    "Scene Planning"
  ).catch((error) => {
    throw new Error(`Scene planning failed: ${error.message}`);
  });
  
  console.log("📝 Base:", plan.basePrompt);
  console.log("🎬 Acts:", plan.acts);

  onProgress?.(0, 9, "Creating scenes...");
  const sceneImages: string[] = [];
  
  for (let i = 0; i < plan.acts.length; i++) {
    onProgress?.(i + 1, 9, `Scene ${i + 1}/3...`);
    
    const sceneImage = await retryOperation(
      () => generateSceneImage(faceUris, plan.acts[i]),
      `Scene Image ${i + 1}/3`,
      1
    );
    
    sceneImages.push(sceneImage);
    console.log(`✅ Scene ${i + 1}/3 ready`);
    
    if (i < plan.acts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log("✅ All 3 scenes ready");

  onProgress?.(3, 9, "Animating...");
  
  const jobs = plan.acts.map((act, i) =>
    retryOperation(
      () => klingI2V(act, sceneImages[i]),
      `Kling Video ${i + 1}/3`
    ).then((r) => {
      onProgress?.(4 + i, 9, `Video ${i + 1}/3...`);
      return r;
    }).catch((error) => {
      console.error(`❌ Failed to generate video ${i + 1}/3 after retries:`, error);
      throw new Error(`Video generation failed for scene ${i + 1}: ${error.message}`);
    })
  );
  
  const results = await Promise.all(jobs);
  let localClips = results.map((r) => r.localUri);
  const coverUrl = results[0]?.coverUrl ?? null;

  console.log("✅ All 3 Kling videos generated");

  if (ENABLE_AUDIO) {
    console.log("🎵 Starting Mirelo SFX audio enhancement...");
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
          () => addAudioToVideo(
            publicUrl,
            plan.acts[i],
            5
          ),
          `Mirelo Audio ${i + 1}/3`,
          1
        );
        
        audioEnhancedClips.push(enhancedVideo);
        audioSuccessCount++;
        console.log(`✅ Audio added to clip ${i + 1}/3`);
        
        onProgress?.(7 + i / 3, 9, `Audio ${i + 1}/3...`);
        
      } catch (error) {
        console.error(`⚠️ Failed to add audio to clip ${i + 1} after retries:`, error);
        console.log(`ℹ️ Continuing with clip ${i + 1} without audio (graceful degradation)`);
        audioEnhancedClips.push(localClips[i]);
      }
    }
    
    localClips = audioEnhancedClips;
    console.log(`✅ Audio enhancement complete (${audioSuccessCount}/3 clips with audio)`);
  } else {
    console.log("ℹ️ Audio enhancement disabled");
  }

  onProgress?.(8, 9, "Stitching...");
  let stitchedVideoUrl = localClips[0];
  
  try {
    stitchedVideoUrl = await retryOperation(
      () => stitchWithCloudinary(localClips, true),
      "Video Stitching"
    );
    console.log("✅ Stitched successfully");
  } catch (e) {
    console.warn("⚠️ Stitch failed after retries, returning first clip:", e);
  }

  const dt = Date.now() - t0;
  const per5s = Number(process.env.EXPO_PUBLIC_KLING_PRICE_PER5S || 0.30);
  const audioPerSec = 0.007;
  const audioCost = ENABLE_AUDIO ? (audioPerSec * 5 * 3) : 0;
  const totalCost = (per5s * 3) + (0.05 * 3) + audioCost;

  console.log(`💰 Total cost: $${totalCost.toFixed(2)} (with audio: ${ENABLE_AUDIO})`);
  console.log(`⏱️ Generation time: ${(dt / 1000).toFixed(1)}s`);

  return {
    videoUrls: localClips,
    stitchedVideoUrl,
    coverUrl,
    totalCost,
    generationTime: dt,
  };
}

export default {};