// app/utils/backgroundRemoval.ts
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

const REMOVE_BG_API_KEY = process.env.EXPO_PUBLIC_REMOVE_BG_API_KEY;

/**
 * Removes background from an image using Remove.bg API
 * @param imageUri - Local URI of the image
 * @returns URI of image with transparent background (PNG)
 */
export async function removeBackground(
  imageUri: string,
  options?: {
    size?: 'preview' | 'full' | 'auto'; // preview = 0.25 MP (free), full = up to 25 MP
    type?: 'auto' | 'person' | 'product' | 'car';
    format?: 'png' | 'jpg';
    roi?: string; // Region of interest
  }
): Promise<string> {
  
  if (!REMOVE_BG_API_KEY) {
    console.warn('⚠️ No Remove.bg API key configured, skipping background removal');
    return imageUri; // Return original if no API key
  }

  console.log('🎨 [REMOVE.BG] Starting background removal...');
  console.log('📷 Input image:', imageUri);
  
  try {
    // Step 1: Optimize image size to save API credits
    const optimizedImage = await optimizeImageForRemoveBg(imageUri);
    console.log('📐 Image optimized for processing');

    // Step 2: Read image as base64
    const base64 = await FileSystem.readAsStringAsync(optimizedImage, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Step 3: Prepare API request
    const formData = new FormData();
    formData.append('image_file_b64', base64);
    formData.append('size', options?.size || 'preview'); // Use preview to save credits
    formData.append('type', options?.type || 'person'); // Optimize for people
    formData.append('format', options?.format || 'png'); // PNG for transparency
    
    if (options?.roi) {
      formData.append('roi', options.roi);
    }

    console.log('📤 Sending to Remove.bg API...');
    
    // Step 4: Call Remove.bg API
    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': REMOVE_BG_API_KEY,
      },
      body: formData,
    });

    // Step 5: Handle response
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Remove.bg API error:', response.status, errorText);
      
      if (response.status === 402) {
        throw new Error('Remove.bg credits exhausted. Please check your account.');
      } else if (response.status === 403) {
        throw new Error('Invalid Remove.bg API key. Please check your configuration.');
      } else {
        throw new Error(`Remove.bg error: ${response.status}`);
      }
    }

    // Check remaining credits
    const creditsRemaining = response.headers.get('X-Credits-Remaining');
    if (creditsRemaining) {
      console.log(`💳 Remove.bg credits remaining: ${creditsRemaining}`);
    }

    // Step 6: Save the result
    const blob = await response.blob();
    const base64Result = await blobToBase64(blob);
    
    // Save with transparent background
    const filename = `no_bg_${Date.now()}.png`;
    const outputPath = `${FileSystem.documentDirectory}${filename}`;
    
    await FileSystem.writeAsStringAsync(outputPath, base64Result, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    console.log('✅ [REMOVE.BG] Background removed successfully!');
    console.log('💾 Saved to:', outputPath);
    
    // Clean up temporary file
    if (optimizedImage !== imageUri) {
      await FileSystem.deleteAsync(optimizedImage, { idempotent: true });
    }
    
    return outputPath;

  } catch (error: any) {
    console.error('❌ [REMOVE.BG] Failed to remove background:', error);
    
    // Return original image on error so the app continues working
    return imageUri;
  }
}

/**
 * Optimize image size before sending to Remove.bg to save credits
 */
async function optimizeImageForRemoveBg(imageUri: string): Promise<string> {
  try {
    // Resize image to max 1500x1500 to save API credits
    const manipResult = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1500, height: 1500 } }],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    return manipResult.uri;
  } catch (error) {
    console.warn('Could not optimize image, using original:', error);
    return imageUri;
  }
}

/**
 * Convert Blob to Base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data:image/png;base64, prefix
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Test function to check if Remove.bg API is working
 */
export async function testRemoveBgConnection(): Promise<boolean> {
  if (!REMOVE_BG_API_KEY) {
    console.log('❌ No Remove.bg API key configured');
    return false;
  }

  try {
    const response = await fetch('https://api.remove.bg/v1.0/account', {
      method: 'GET',
      headers: {
        'X-Api-Key': REMOVE_BG_API_KEY,
      },
    });

    if (response.ok) {
      const account = await response.json();
      console.log('✅ Remove.bg connected!');
      console.log('💳 Credits:', account.data.attributes.credits);
      console.log('📊 API calls this month:', account.data.attributes.api_calls);
      return true;
    } else {
      console.error('❌ Remove.bg connection failed:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Could not connect to Remove.bg:', error);
    return false;
  }
}

/**
 * Process multiple images in batch
 */
export async function removeBackgroundBatch(
  imageUris: string[],
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const results: string[] = [];
  
  for (let i = 0; i < imageUris.length; i++) {
    try {
      onProgress?.(i + 1, imageUris.length);
      const result = await removeBackground(imageUris[i]);
      results.push(result);
      
      // Small delay between API calls
      if (i < imageUris.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`Failed to process image ${i + 1}:`, error);
      results.push(imageUris[i]); // Use original on failure
    }
  }
  
  return results;
}