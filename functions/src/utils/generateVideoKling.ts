// functions/src/utils/generateVideoKling.ts - HYBRID: Smart cleaning + Scene chaining + Optional faces
import * as FileSystem from "./fileSystem";
import { getScenePlan } from "./enhancePrompt";
import { stitchWithCloudinary } from "./cloudinaryStitch";
import { generateSceneImage } from "./sceneImageGenerator";
import { addAudioToVideo } from "./addAudioToVideo";
import { processPromptForGeneration } from "./smartPromptProcessor";

const DURATION = "5" as "5";
const CFG = 0.5;
const USE_SCENE_IMAGE_GEN = process.env.EXPO_PUBLIC_USE_SCENE_IMAGE_GEN === "1";
const ENABLE_AUDIO = process.env.EXPO_PUBLIC_ENABLE_AUDIO === "1";
const MAX_RETRIES = 2;

const KLING_NEGATIVE_PROMPT = 
  "blur, distort, low quality, warping, morphing, artifacts, " +
  "flickering, choppy motion, face distortion, unnatural physics";

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

async function klingI2V(prompt: string, imageUrl: string): Promise<{ localUri: string; coverUrl: string | null }> {
  const endpoint = "https://fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
  
  console.log(`🎬 Generating Kling video with prompt: "${prompt}"`);
  
  const body: any = {
    prompt: prompt,
    image_url: imageUrl,
    duration: DURATION,
    cfg_scale: CFG,
    aspect_ratio: "9:16",
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
      
      const sceneImage = await retryOperation(
        () => generateSceneImage(
          faceUris,  // ✅ Can be undefined!
          plan.acts[i],
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
  
  const jobs = plan.acts.map((act, i) =>
    retryOperation(
      () => klingI2V(act, sceneImages[i]),
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
    })
  );
  
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
  const coverUrl = results[0]?.coverUrl ?? null;

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
    totalCost,
    generationTime: dt,
  };
}

export default {};