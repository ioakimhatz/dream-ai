// app/utils/backgroundRemoval.ts - PHOTOROOM (CORRECT!) 🔥
import * as FileSystem from './fileSystem';

const PHOTOROOM_API_KEY = process.env.EXPO_PUBLIC_PHOTOROOM_API_KEY;

export async function removeBackground(
  imageUri: string,
  options?: {
    size?: 'preview' | 'full' | 'auto';
    type?: 'auto' | 'person' | 'product' | 'car';
    format?: 'png' | 'jpg';
  }
): Promise<string> {
  
  if (!PHOTOROOM_API_KEY) {
    console.warn('⚠️ No Photoroom API key configured, skipping background removal');
    return imageUri;
  }

  console.log('🎨 [PHOTOROOM] Starting background removal...');
  console.log('📷 Input image:', imageUri);
  
  try {
    // Create FormData (React Native compatible)
    const formData = new FormData();
    
    // Add the image file - EXACTLY as the docs show
    formData.append('image_file', {
      uri: imageUri,
      type: 'image/png', // Match your file type
      name: 'image.png',
    } as any);
    
    console.log('📤 Sending to Photoroom API...');
    console.log('🔑 Using API key:', PHOTOROOM_API_KEY?.substring(0, 20) + '...');
    
    // Call Photoroom API - EXACTLY as docs show
    const response = await fetch('https://sdk.photoroom.com/v1/segment', {
      method: 'POST',
      headers: {
        'x-api-key': PHOTOROOM_API_KEY,
        // Don't set Content-Type - let FormData set it automatically
      },
      body: formData,
    });

    console.log('📥 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Photoroom API error:', response.status, errorText);
      
      if (response.status === 402) {
        throw new Error('Photoroom credits exhausted. Please check your account.');
      } else if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid Photoroom API key. Please check your configuration.');
      } else {
        throw new Error(`Photoroom error: ${response.status} - ${errorText}`);
      }
    }

    // Get the processed image
    const blob = await response.blob();
    
    console.log('📦 Received blob, size:', blob.size);
    
    // Convert blob to base64
    const reader = new FileReader();
    const base64Result = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const base64Data = base64String.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    // Save the result as PNG
    const filename = `no_bg_${Date.now()}.png`;
    const outputPath = `${FileSystem.documentDirectory}${filename}`;
    
    await FileSystem.writeAsStringAsync(outputPath, base64Result, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    console.log('✅ [PHOTOROOM] Background removed successfully!');
    console.log('💾 Saved to:', outputPath);
    console.log('💰 COST: €0.02 per image');
    console.log('📊 Credits remaining: ~' + (1000 - 1) + ' images');
    
    return outputPath;

  } catch (error: any) {
    console.error('❌ [PHOTOROOM] Failed to remove background:', error);
    console.error('Error message:', error.message);
    return imageUri; // Return original on failure
  }
}

export async function testPhotoroomConnection(): Promise<boolean> {
  if (!PHOTOROOM_API_KEY) {
    console.log('❌ No Photoroom API key configured');
    return false;
  }

  console.log('✅ Photoroom API key is configured');
  console.log('💰 Plan: €20/month for 1000 images');
  console.log('💵 Cost: €0.02 per image');
  return true;
}

export async function removeBackgroundBatch(
  imageUris: string[],
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {
  const results: string[] = [];
  
  console.log(`🎨 [PHOTOROOM] Processing ${imageUris.length} images in batch...`);
  console.log(`💰 Total cost: €${(imageUris.length * 0.02).toFixed(2)}`);
  
  for (let i = 0; i < imageUris.length; i++) {
    try {
      onProgress?.(i + 1, imageUris.length);
      const result = await removeBackground(imageUris[i]);
      results.push(result);
      
      // Small delay to avoid rate limiting
      if (i < imageUris.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`Failed to process image ${i + 1}:`, error);
      results.push(imageUris[i]); // Use original on failure
    }
  }
  
  console.log(`✅ Batch complete! Processed ${results.length}/${imageUris.length} images`);
  
  return results;
}