// app/utils/generateDreamVideo.ts - FINAL VERSION (NO SORA)
import { getScenePlan } from "./enhancePrompt";
import { generate3ClipDreamCinemaParallel } from "./generateVideoFal";
import { generate3ClipKlingParallel } from "./generateVideoKling";
import { prepareCharacterReference } from "./characterBinder";
import { enhanceFaceConsistency } from "./faceEnhancer";

const USE_KLING = process.env.EXPO_PUBLIC_USE_KLING === "1";
const USE_CHARACTER_PIPELINE = process.env.EXPO_PUBLIC_USE_CHARACTER_PIPELINE === "1";
const MAX_RETRIES = 2;

interface CharacterRefs {
  frontView: string;
  sideView: string;
  actionPose: string;
  originalFace: string;
}

export interface GenerationResult {
  videoUrls: string[];
  coverUrl: string | null;
  refundUser?: boolean;
  partialSuccess?: boolean;
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  operationName: string,
  maxRetries: number = MAX_RETRIES,
  onRetry?: (attempt: number, error: any) => void
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`🔄 [${operationName}] Attempt ${attempt}/${maxRetries + 1}`);
      return await operation();
    } catch (error) {
      lastError = error;
      console.error(`❌ [${operationName}] Attempt ${attempt} failed:`, error);
      
      if (attempt <= maxRetries) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Retrying in ${delayMs}ms...`);
        onRetry?.(attempt, error);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError;
}

export async function generateDreamVideo(
  rawText: string,
  selectedImages: string[] = [],
  onProgress?: (step: string, progress: number) => void
): Promise<GenerationResult> {
  try {
    console.log(`🎬 Pipeline: ${USE_KLING ? 'KLING' : 'DREAM CINEMA'}`);
    
    onProgress?.("Analyzing your dream…", 5);

    const faceImageUris = selectedImages.length > 0 ? selectedImages : undefined;

    // CHARACTER PIPELINE (Kling-based with face consistency)
    if (USE_CHARACTER_PIPELINE && faceImageUris) {
      return await generateWithCharacterPipeline(
        rawText,
        faceImageUris[0],
        onProgress
      );
    }

    onProgress?.("Preparing scene generation…", 10);

    // KLING OR DREAM CINEMA PIPELINE
    const result = await retryOperation(
      async () => {
        return USE_KLING
          ? await generate3ClipKlingParallel(rawText, faceImageUris, (c, t, step) => {
              const p = 15 + (c / t) * 65;
              onProgress?.(step || "Kling is rendering your scenes…", p);
            })
          : await generate3ClipDreamCinemaParallel(rawText, faceImageUris?.[0], (c, t) => {
              const p = 15 + (c / t) * 65;
              onProgress?.("Dream AI is creating your scenes…", p);
            });
      },
      "Video Generation",
      MAX_RETRIES,
      (attempt, error) => {
        onProgress?.(`Retrying generation (attempt ${attempt + 1})...`, 15);
      }
    );

    onProgress?.("Finalizing your cinema…", 90);
    onProgress?.("Your dream cinema is ready!", 100);

    return {
      videoUrls: [result.stitchedVideoUrl],
      coverUrl: result.coverUrl,
      refundUser: false,
    };
  } catch (err: any) {
    console.error("❌ [DREAM AI] Error generating cinema:", err);
    
    const errorInfo = handleVideoError(err);
    
    const error = new Error(errorInfo.userMessage) as any;
    error.refundUser = errorInfo.shouldRefund;
    error.errorType = errorInfo.errorType;
    error.originalError = err;
    throw error;
  }
}

async function generateWithCharacterPipeline(
  rawPrompt: string,
  faceImageUri: string,
  onProgress?: (step: string, progress: number) => void
): Promise<GenerationResult> {
  try {
    onProgress?.("Preparing character reference…", 10);
    
    const characterRefs = await retryOperation(
      () => prepareCharacterReference(faceImageUri, {
        numPoses: 3,
        style: "cinematic",
      }),
      "Character Reference Generation"
    );

    onProgress?.("Character locked in! Generating scenes…", 20);

    const plan = await getScenePlan(rawPrompt);
    const acts = plan.acts.map((a) => `${a} | ${plan.globalStyle}`);

    const videoClips = await generateClipsWithRetry(
      acts,
      characterRefs,
      (current, total) => {
        const p = 20 + (current / total) * 55;
        onProgress?.(`Rendering scene ${current}/${total}…`, p);
      }
    );

    onProgress?.("Enhancing face consistency…", 75);

    const enhancedClips = await enhanceFaceConsistency(
      videoClips,
      faceImageUri,
      (current, total) => {
        const p = 75 + (current / total) * 10;
        onProgress?.("Polishing final details…", p);
      }
    );

    onProgress?.("Stitching your dream cinema…", 85);

    const stitchedUrl = await retryOperation(
      () => stitchVideos(enhancedClips),
      "Video Stitching"
    );

    onProgress?.("Your dream cinema is ready!", 100);

    return {
      videoUrls: [stitchedUrl],
      coverUrl: enhancedClips[0] || null,
      refundUser: false,
    };
  } catch (err: any) {
    console.error("❌ Character pipeline failed:", err);
    const errorInfo = handleVideoError(err);
    const error = new Error(errorInfo.userMessage) as any;
    error.refundUser = errorInfo.shouldRefund;
    error.errorType = errorInfo.errorType;
    throw error;
  }
}

async function generateClipsWithRetry(
  scenes: string[],
  characterRefs: CharacterRefs,
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const clips: string[] = [];
  const failedIndices: number[] = [];

  for (let i = 0; i < scenes.length; i++) {
    onProgress?.(i + 1, scenes.length);

    try {
      const clipUrl = await retryOperation(
        () => generateSingleClipWithCharacter(scenes[i], characterRefs),
        `Clip ${i + 1}/${scenes.length}`,
        1
      );
      clips.push(clipUrl);
    } catch (error) {
      console.error(`❌ Failed to generate clip ${i + 1}:`, error);
      failedIndices.push(i);
      clips.push("");
    }
  }

  if (failedIndices.length > scenes.length / 2) {
    throw new Error(`Failed to generate ${failedIndices.length}/${scenes.length} clips`);
  }

  return clips.filter(c => c !== "");
}

async function generateSingleClipWithCharacter(
  scenePrompt: string,
  characterRefs: CharacterRefs
): Promise<string> {
  const { generateVideoWithCharacter } = await import("./characterBinder");
  return generateVideoWithCharacter(scenePrompt, characterRefs);
}

async function stitchVideos(clips: string[]): Promise<string> {
  const { stitchWithCloudinary } = await import("./cloudinaryStitch");
  return stitchWithCloudinary(clips, true);
}

interface ErrorInfo {
  message: string;
  userMessage: string;
  shouldRefund: boolean;
  errorType: 'api' | 'network' | 'quota' | 'config' | 'unknown';
}

function handleVideoError(err: any): ErrorInfo {
  const msg = `${String(err?.message || err)}`.toLowerCase();

  if (msg.includes("scene plan") || msg.includes("analyzing")) {
    return {
      message: err.message,
      userMessage: "Failed to analyze your dream. Your dream has been restored. Please try again!",
      shouldRefund: true,
      errorType: 'api',
    };
  }
  
  if (msg.includes("scene image") || msg.includes("nano banana")) {
    return {
      message: err.message,
      userMessage: "Failed to create scenes. Your dream has been restored. Try simplifying your dream description!",
      shouldRefund: true,
      errorType: 'api',
    };
  }
  
  if (msg.includes("missing") && (msg.includes("api") || msg.includes("key"))) {
    return {
      message: err.message,
      userMessage: "Service configuration error. Your dream has been restored. Please contact support!",
      shouldRefund: true,
      errorType: 'config',
    };
  }

  if (msg.includes("kling") || msg.includes("video generation") || msg.includes("i2v")) {
    return {
      message: err.message,
      userMessage: "Video generation failed after 3 attempts. Try a simpler prompt or try again later.",
      shouldRefund: false,
      errorType: 'api',
    };
  }
  
  if (msg.includes("mirelo") || msg.includes("audio")) {
    return {
      message: err.message,
      userMessage: "Couldn't add audio effects. Your video was created without sound.",
      shouldRefund: false,
      errorType: 'api',
    };
  }
  
  if (msg.includes("cloudinary upload") || msg.includes("upload failed")) {
    return {
      message: err.message,
      userMessage: "Upload failed, but your videos were created. Please try again!",
      shouldRefund: false,
      errorType: 'network',
    };
  }
  
  if (msg.includes("stitch") && !msg.includes("preparing")) {
    return {
      message: err.message,
      userMessage: "Couldn't combine clips, but individual videos were saved. Check your dream history!",
      shouldRefund: false,
      errorType: 'api',
    };
  }

  if (msg.includes("timeout") || msg.includes("network") || msg.includes("fetch failed")) {
    if (msg.includes("video") || msg.includes("kling")) {
      return {
        message: err.message,
        userMessage: "Generation timed out. The service may be busy. Please try again in a few minutes.",
        shouldRefund: false,
        errorType: 'network',
      };
    }
    return {
      message: err.message,
      userMessage: "Connection failed. Your dream has been restored. Check your internet and try again!",
      shouldRefund: true,
      errorType: 'network',
    };
  }
  
  if (msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("api key")) {
    if (msg.includes("scene")) {
      return {
        message: err.message,
        userMessage: "Authentication failed. Your dream has been restored. Please contact support!",
        shouldRefund: true,
        errorType: 'config',
      };
    }
    return {
      message: err.message,
      userMessage: "Authentication error during generation. Please contact support.",
      shouldRefund: false,
      errorType: 'config',
    };
  }

  return {
    message: err.message,
    userMessage: "Generation failed. Please try again with a different dream description.",
    shouldRefund: false,
    errorType: 'unknown',
  };
}

export { handleVideoError, retryOperation };