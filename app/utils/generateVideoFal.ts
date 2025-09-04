// app/utils/generateVideoFal.ts - CORRECTED HAILUO-02 ENDPOINTS

import * as FileSystem from 'expo-file-system';
import { stitchVideos } from './videoStitching';

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
    throw new Error(`FAL API key ${index + 1} not configured`);
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

// Single video generation with specific API key and CORRECTED ENDPOINTS
export async function generateSingleHailuoVideoWithKey(
  prompt: string,
  apiKeyIndex: number = 0,
  imageUri?: string
): Promise<{ videoUrl: string; coverUrl: string | null }> {
  
  const apiKey = getApiKey(apiKeyIndex);
  
  console.log(`🎬 [HAILUO ${apiKeyIndex + 1}] Generating 6-second video...`);
  console.log(`📝 Prompt: ${prompt.slice(0, 50)}...`);
  console.log(`🔑 Using API Key ${apiKeyIndex + 1}`);

  try {
    let endpoint: string;
    let requestBody: any;

    if (imageUri && apiKeyIndex === 0) {
      // CORRECTED: Use proper Hailuo-02 image-to-video endpoint
      console.log('📷 [HAILUO 02] Using image-to-video for person consistency...');
      
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // FIXED ENDPOINT: Hailuo-02 image-to-video (puts person in video)
      endpoint = 'https://fal.run/fal-ai/minimax/hailuo-02/standard/image-to-video';
      requestBody = {
        prompt: prompt,
        image_url: `data:image/jpeg;base64,${base64}`,
        // Note: Hailuo-02 uses different parameter names than MiniMax
        // Duration is fixed at 6 seconds for standard version
      };
    } else {
      // CORRECTED: Use proper Hailuo-02 text-to-video endpoint
      console.log('📝 [HAILUO 02] Using text-to-video...');
      
      // FIXED ENDPOINT: Hailuo-02 text-to-video ($0.27 per 6s)
      endpoint = 'https://fal.run/fal-ai/minimax/hailuo-02/standard/text-to-video';
      requestBody = {
        prompt: prompt,
        // Duration is automatically 6 seconds for standard version
      };
    }

    console.log(`🚀 [HAILUO ${apiKeyIndex + 1}] Making request to:`, endpoint);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [HAILUO ${apiKeyIndex + 1}] API Error:`, response.status, errorText);
      
      // Better error handling for Hailuo-specific errors
      if (response.status === 402) {
        throw new Error(`Insufficient credits on API key ${apiKeyIndex + 1}`);
      } else if (response.status === 401) {
        throw new Error(`Invalid API key ${apiKeyIndex + 1}`);
      }
      
      throw new Error(`Hailuo-02 API error: ${response.status} - ${errorText.slice(0, 200)}`);
    }

    const result = await response.json();
    console.log('🔍 [HAILUO 02] Response received');

    // Handle Hailuo-02 response format (may be different from MiniMax)
    const videoUrl = result.video?.url || result.url || result.data?.url || result.video_url;
    
    if (!videoUrl) {
      console.error('❌ No video URL found in Hailuo response:', JSON.stringify(result).slice(0, 500));
      throw new Error('No video URL in Hailuo-02 response');
    }

    console.log(`✅ [HAILUO ${apiKeyIndex + 1}] Video generated successfully!`);
    console.log('🎥 Video URL:', videoUrl);
    console.log('💰 Cost: $0.27 per 6-second video');

    // Download video locally for better playback
    const localFileName = `hailuo_${apiKeyIndex + 1}_${Date.now()}.mp4`;
    const localPath = `${FileSystem.documentDirectory}${localFileName}`;
    
    console.log(`⬇️ [HAILUO ${apiKeyIndex + 1}] Downloading video locally...`);
    const downloadResult = await FileSystem.downloadAsync(videoUrl, localPath);
    console.log(`📁 Video saved locally: ${downloadResult.uri}`);
    
    // Try to generate thumbnail
    let coverUrl: string | null = null;
    try {
      coverUrl = await extractVideoThumbnail(downloadResult.uri);
      if (coverUrl) {
        console.log('🖼️ Thumbnail generated:', coverUrl);
      }
    } catch (error) {
      console.warn('⚠️ Thumbnail generation skipped:', error);
    }
    
    return {
      videoUrl: downloadResult.uri,
      coverUrl
    };

  } catch (error: any) {
    console.error(`❌ [HAILUO ${apiKeyIndex + 1}] Generation failed:`, error);
    throw new Error(`Hailuo-02 API Key ${apiKeyIndex + 1} failed: ${error.message}`);
  }
}

// PARALLEL 3-CLIP GENERATION WITH CORRECTED ENDPOINTS
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
  console.log('🚀 [HAILUO PARALLEL] Starting 3-clip generation with 3 API keys...');
  console.log('⚡ Expected time: ~40-60 seconds (3x faster than sequential)');
  console.log('💰 Corrected cost: $0.81 (3 × $0.27 per video)');

  try {
    // Step 1: Split prompt into 3 acts
    onProgress?.(0, 3, 'Creating 3-act story structure...');
    const acts = await splitPromptInto3Acts(fullPrompt, !!imageUri);
    console.log('📝 [HAILUO PARALLEL] Story split into 3 acts');

    // Step 2: Generate all 3 videos in parallel using corrected endpoints
    onProgress?.(0, 3, 'Generating 3 videos simultaneously with Hailuo-02...');
    console.log('🎬 [HAILUO PARALLEL] Starting simultaneous generation...');
    
    const generationPromises = acts.map((act, index) => 
      generateSingleHailuoVideoWithKey(
        act,
        index, // Use different API key for each video
        index === 0 ? imageUri : undefined // Only first video gets image for character consistency
      ).then(result => {
        console.log(`✅ [HAILUO PARALLEL] Video ${index + 1}/3 completed`);
        onProgress?.(index + 1, 3, `Video ${index + 1}/3 completed`);
        return result;
      }).catch(error => {
        console.error(`❌ [HAILUO PARALLEL] Video ${index + 1} failed:`, error);
        throw new Error(`Video ${index + 1} failed: ${error.message}`);
      })
    );

    // Wait for all videos to complete
    const videoResults = await Promise.all(generationPromises);
    
    const generationTime = Date.now() - startTime;
    console.log(`⚡ [HAILUO PARALLEL] All 3 videos generated in ${Math.round(generationTime / 1000)}s`);
    
    const videoUrls = videoResults.map(r => r.videoUrl);
    const firstCover = videoResults[0]?.coverUrl;

    // Step 3: Stitch videos together
    onProgress?.(3, 3, 'Stitching videos into 18-second cinema...');
    console.log('🎬 [STITCHING] Combining 3 videos into single 18-second video...');
    
    let stitchedVideoUrl = videoUrls[0]; // Default fallback
    
    try {
      stitchedVideoUrl = await stitchVideos(videoUrls, (step) => {
        console.log(`🔧 [STITCHING] ${step}`);
      });
      console.log('✅ [STITCHING] 18-second cinema created successfully!');
    } catch (stitchError) {
      console.error('⚠️ [STITCHING] Failed:', stitchError);
      console.log('🔄 [FALLBACK] Using first video only');
    }

    const totalTime = Date.now() - startTime;
    
    console.log(`🎉 [HAILUO SUCCESS] Dream cinema completed in ${Math.round(totalTime / 1000)}s`);
    console.log(`⚡ Speed improvement: ~${Math.round((160 - totalTime/1000) / 160 * 100)}% faster`);
    
    return {
      videoUrls,
      stitchedVideoUrl,
      coverUrl: firstCover,
      totalCost: 0.81, // Corrected cost: 3 × $0.27
      generationTime: totalTime
    };

  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [HAILUO PARALLEL] Failed after ${Math.round(totalTime / 1000)}s:`, error);
    throw new Error(`Hailuo-02 parallel generation failed: ${error.message}`);
  }
}

// Enhanced prompt splitting optimized for Hailuo-02
async function splitPromptInto3Acts(
  fullPrompt: string, 
  hasFace: boolean
): Promise<string[]> {
  
  const openaiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  
  if (!openaiKey) {
    console.log('⚠️ No OpenAI key, using manual split optimized for Hailuo-02');
    return [
      `${fullPrompt}. OPENING SCENE: Wide establishing cinematic shot introducing the environment and character with atmospheric lighting and mood.`,
      `${fullPrompt}. MAIN ACTION: Dynamic medium shot capturing the primary movement and story development with smooth camera work.`,
      `${fullPrompt}. CLIMAX MOMENT: Close-up emotional conclusion showing character reaction with dramatic depth of field and lighting.`
    ];
  }

  try {
    console.log('🤖 Creating Hailuo-02 optimized 3-act structure...');
    
    const systemPrompt = `Create 3 video prompts optimized for Hailuo-02 AI video generation. Each prompt will generate a 6-second video clip in parallel.

Requirements for Hailuo-02:
- Each prompt must be detailed and cinematic
- Include specific camera movements and angles  
- Rich visual descriptions for better AI interpretation
- Character consistency across all 3 scenes
${hasFace ? '- Maintain the same person appearance in all scenes' : ''}
- Each scene should feel like part of a complete story

Structure:
- Act 1: Wide establishing shot introducing setting and character
- Act 2: Medium shot with main action or character development
- Act 3: Close-up emotional climax or resolution

Return JSON: {"acts": ["detailed_hailuo_act1", "detailed_hailuo_act2", "detailed_hailuo_act3"]}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Create 3 Hailuo-02 optimized acts: "${fullPrompt}"` }
        ],
        max_tokens: 800,
        temperature: 0.7
      }),
    });

    if (response.ok) {
      const result = await response.json();
      const parsed = JSON.parse(result.choices[0]?.message?.content || '{}');
      
      if (parsed.acts && Array.isArray(parsed.acts) && parsed.acts.length === 3) {
        console.log('✅ AI-generated 3 Hailuo-02 optimized acts');
        return parsed.acts;
      }
    }
    
    throw new Error('AI generation failed');

  } catch (error) {
    console.warn('⚠️ AI splitting failed, using Hailuo-02 optimized fallback:', error);
    
    return [
      `${fullPrompt} - ESTABLISHING: Wide cinematic shot introducing the full scene with professional lighting and atmosphere.`,
      `${fullPrompt} - DEVELOPMENT: Medium shot capturing dynamic action with smooth camera movement and character focus.`,
      `${fullPrompt} - RESOLUTION: Close-up emotional moment with dramatic lighting and shallow depth of field.`
    ];
  }
}

// Legacy compatibility - now uses corrected Hailuo-02 parallel generation
export async function generateVideoFal(
  prompt: string,
  durationSeconds: number = 8,
  imageUri?: string
): Promise<{ videoUrl: string; coverUrl: string | null }> {
  
  console.log('🔄 [LEGACY] Redirecting to Hailuo-02 parallel 3-clip system...');
  
  const result = await generate3ClipDreamCinemaParallel(prompt, imageUri);
  
  return {
    videoUrl: result.stitchedVideoUrl,
    coverUrl: result.coverUrl
  };
}

// Check if parallel generation is properly configured
export function checkParallelSetup(): {
  configured: boolean;
  availableKeys: number;
  missingKeys: string[];
} {
  const availableKeys = FAL_API_KEYS.filter(key => !!key).length;
  const missingKeys: string[] = [];
  
  if (!FAL_API_KEYS[0]) missingKeys.push('EXPO_PUBLIC_FAL_API_KEY_1');
  if (!FAL_API_KEYS[1]) missingKeys.push('EXPO_PUBLIC_FAL_API_KEY_2'); 
  if (!FAL_API_KEYS[2]) missingKeys.push('EXPO_PUBLIC_FAL_API_KEY_3');
  
  return {
    configured: availableKeys >= 3,
    availableKeys,
    missingKeys
  };
}

// Utility functions
export async function checkHailuoStatus(): Promise<boolean> {
  const apiKey = getApiKey(0);
  
  try {
    const response = await fetch('https://fal.run/health', {
      method: 'GET',
      headers: {
        'Authorization': `Key ${apiKey}`,
      },
    });
    
    return response.ok;
  } catch {
    return false;
  }
}

export { extractVideoThumbnail };
