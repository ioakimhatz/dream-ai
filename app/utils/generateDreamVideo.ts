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

    console.log('🚀 [DREAM AI] Starting cinema generation...');
    console.log('⚡ Dream AI Cinema Engine v2.0 - Optimized pipeline');
    onProgress?.('Dream AI is analyzing your dream...', 10);
    
    // Generate 3 clips in parallel using Dream AI's cinema engine
    const result = await generate3ClipDreamCinemaParallel(
      scenePrompt, 
      selectedImages.length > 0 ? selectedImages[0] : undefined,
      (completed: number, total: number, step: string) => {
        // Custom progress messages - NO HAILUO BRANDING
        const progressMessages = [
          'Dream AI is creating your scenes...',
          'Rendering dream sequences...',
          'Applying cinematic effects...',
          'Processing dream visuals...',
          'Enhancing dream atmosphere...'
        ];
        
        // Use custom message instead of passed step (which might contain Hailuo)
        const messageIndex = Math.min(Math.floor(completed), progressMessages.length - 1);
        const customMessage = progressMessages[messageIndex] || 'Processing your dream...';
        
        const progress = 10 + (completed / total) * 70;
        onProgress?.(customMessage, progress);
      }
    );
    
    onProgress?.('Dream AI is finalizing your cinema...', 90);
    
    console.log('✅ [DREAM AI] Cinema generation complete!');
    console.log('🎬 Dream cinema ready:', result.stitchedVideoUrl);
    console.log('⚡ Generation time:', Math.round(result.generationTime / 1000) + 's');
    console.log('💰 Processing cost: $' + result.totalCost);
    
    onProgress?.('Your dream cinema is ready!', 100);
    
    // Return the STITCHED video as the primary video
    return {
      videoUrls: [result.stitchedVideoUrl], // Single 18-second stitched video
      coverUrl: result.coverUrl
    };
    
  } catch (err: any) {
    console.error('❌ [DREAM AI] Error generating cinema:', err);
    
    // Clean error messages - no provider branding
    if (err.message?.includes('credits') || err.message?.includes('insufficient')) {
      throw new Error('Insufficient Dream AI credits. Please upgrade your plan.');
    } else if (err.message?.includes('API') || err.message?.includes('key')) {
      throw new Error('Dream AI configuration error. Please contact support.');
    } else if (err.message?.includes('Cloudinary') || err.message?.includes('stitch')) {
      throw new Error('Dream AI processing failed. Please try again.');
    } else if (err.message?.includes('parallel') || err.message?.includes('timeout')) {
      throw new Error('Dream AI servers are busy. Please try again in a moment.');
    }
    
    // Generic error - don't expose technical details
    throw new Error('Dream AI generation failed. Please try again.');
  }
}