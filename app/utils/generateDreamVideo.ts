// app/utils/generateDreamVideo.ts - PARALLEL GENERATION (3X FASTER)
import { enhancePrompt } from './enhancePrompt';
import { generate3ClipDreamCinemaParallel } from './generateVideoFal';

export async function generateDreamVideo(
  rawText: string, 
  selectedImages: string[] = [],
  onProgress?: (step: string, progress: number) => void
): Promise<{
  videoUrls: string[];   // [stitchedVideoUrl] - Single 18-second video
  coverUrl: string | null;
}> {
  try {
    // Enhance the prompt for better video generation
    let scenePrompt = rawText?.trim() || '';
    
    try {
      const scenes = await enhancePrompt(rawText, selectedImages);
      if (Array.isArray(scenes) && scenes[0]) scenePrompt = scenes[0];
    } catch (e) {
      console.warn('enhancePrompt failed, using raw text', e);
    }

    console.log('🚀 [DREAM AI] Starting PARALLEL 3-clip cinema generation...');
    console.log('⚡ Using 3 API keys for 3x faster generation');
    onProgress?.('Starting parallel dream cinema generation...', 10);
    
    // Generate 3 clips in parallel using 3 API keys (3x faster)
    const result = await generate3ClipDreamCinemaParallel(
      scenePrompt, 
      selectedImages.length > 0 ? selectedImages[0] : undefined,
      (completed: number, total: number, step: string) => {
        // Map parallel progress to main progress (10-80%)
        const progress = 10 + (completed / total) * 70;
        onProgress?.(step, progress);
      }
    );
    
    onProgress?.('Finalizing your dream cinema...', 90);
    
    console.log('✅ [DREAM AI] PARALLEL dream cinema generation complete!');
    console.log('🎬 Stitched video URL:', result.stitchedVideoUrl);
    console.log('⚡ Generation time:', Math.round(result.generationTime / 1000) + 's');
    console.log('💰 Total cost: $' + result.totalCost);
    
    onProgress?.('Dream cinema ready!', 100);
    
    // Return the STITCHED video as the primary video
    return {
      videoUrls: [result.stitchedVideoUrl], // Single 18-second stitched video
      coverUrl: result.coverUrl
    };
    
  } catch (err: any) {
    console.error('❌ [DREAM AI] Error generating parallel dream cinema:', err);
    
    if (err.message?.includes('credits')) {
      throw new Error('Insufficient credits. Please add credits to your fal.ai accounts.');
    } else if (err.message?.includes('API key')) {
      throw new Error('Invalid API keys. Check your .env file configuration.');
    } else if (err.message?.includes('Cloudinary')) {
      throw new Error('Video stitching failed. Check your Cloudinary configuration.');
    } else if (err.message?.includes('parallel')) {
      throw new Error('Parallel generation failed. One or more API keys may be invalid.');
    }
    
    throw new Error(`Dream generation failed: ${err.message}`);
  }
}