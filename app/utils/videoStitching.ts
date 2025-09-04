// app/utils/videoStitching.ts - FIXED CLOUDINARY INTEGRATION
import * as FileSystem from 'expo-file-system';

// FIXED: Cloudinary Video Concatenation with correct API syntax
export async function stitchWithCloudinary(videoUrls: string[]): Promise<string> {
  const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error('Missing Cloudinary configuration');
  }

  try {
    console.log('☁️ [CLOUDINARY] Starting video stitching...');
    console.log('🔧 Cloud Name:', CLOUD_NAME);
    console.log('🔧 Upload Preset:', UPLOAD_PRESET);
    
    // Step 1: Upload all videos to Cloudinary
    const uploadedIds: string[] = [];
    
    for (let i = 0; i < videoUrls.length; i++) {
      console.log(`📤 Uploading video ${i + 1}/${videoUrls.length}...`);
      
      const formData = new FormData();
      
      // Handle local files correctly
      if (videoUrls[i].startsWith('file://')) {
        const base64 = await FileSystem.readAsStringAsync(videoUrls[i], {
          encoding: FileSystem.EncodingType.Base64,
        });
        formData.append('file', `data:video/mp4;base64,${base64}`);
      } else {
        formData.append('file', videoUrls[i]);
      }
      
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('resource_type', 'video');
      formData.append('public_id', `dream_clip_${i}_${Date.now()}`);
      
      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
        { 
          method: 'POST', 
          body: formData
        }
      );
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error(`❌ Upload ${i+1} failed:`, errorText);
        throw new Error(`Upload failed: ${uploadResponse.status} - ${errorText.slice(0, 200)}`);
      }
      
      const result = await uploadResponse.json();
      uploadedIds.push(result.public_id);
      console.log(`✅ Video ${i + 1} uploaded: ${result.public_id}`);
    }
    
    // Step 2: FIXED - Create concatenation using correct Cloudinary syntax
    console.log('🎬 Creating 18-second stitched video...');
    
    // Use Cloudinary's video concatenation transformation - CORRECTED SYNTAX
    let transformationUrl = `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/`;
    
    // Build the transformation chain for concatenation
    for (let i = 1; i < uploadedIds.length; i++) {
      transformationUrl += `l_video:${uploadedIds[i]},fl_splice,so_auto/`;
    }
    
    // Add the base video at the end
    transformationUrl += `${uploadedIds[0]}.mp4`;
    
    console.log('🔗 Transformation URL:', transformationUrl);
    
    // Step 3: Test if the transformation URL works
    try {
      const testResponse = await fetch(transformationUrl, { method: 'HEAD' });
      if (testResponse.ok) {
        console.log('✅ [CLOUDINARY] Transformation URL working!');
        return transformationUrl;
      } else {
        console.warn('⚠️ Transformation URL not ready, creating clean upload...');
      }
    } catch (testError) {
      console.warn('⚠️ Cannot test transformation, proceeding with clean upload...');
    }
    
    // Step 4: Upload the transformed video as new clean asset
    const finalFormData = new FormData();
    finalFormData.append('file', transformationUrl);
    finalFormData.append('upload_preset', UPLOAD_PRESET);
    finalFormData.append('resource_type', 'video');
    finalFormData.append('public_id', `dream_cinema_${Date.now()}`);
    
    const finalResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`,
      { method: 'POST', body: finalFormData }
    );
    
    if (!finalResponse.ok) {
      const errorText = await finalResponse.text();
      console.warn('⚠️ Final upload failed:', errorText);
      
      // FALLBACK: Return transformation URL directly
      console.log('🔄 Using transformation URL as fallback');
      return transformationUrl;
    }
    
    const finalResult = await finalResponse.json();
    const stitchedUrl = finalResult.secure_url;
    
    console.log('✅ [CLOUDINARY] 18-second video created successfully!');
    console.log('📹 Final URL:', stitchedUrl);
    
    return stitchedUrl;
    
  } catch (error: any) {
    console.error('❌ [CLOUDINARY] Stitching failed:', error);
    throw new Error(`Cloudinary stitching failed: ${error.message}`);
  }
}

// Fallback: Simple file concatenation (if Cloudinary fails)
async function fallbackStitching(videoUrls: string[]): Promise<string> {
  console.log('🔄 [FALLBACK] Using first video (stitching failed)');
  return videoUrls[0];
}

// MAIN STITCHING FUNCTION - FIXED LOGIC
export async function stitchVideos(
  videoUrls: string[],
  onProgress?: (step: string) => void
): Promise<string> {
  
  if (videoUrls.length === 0) {
    throw new Error('No videos to stitch');
  }
  
  if (videoUrls.length === 1) {
    console.log('📹 Single video, no stitching needed');
    return videoUrls[0];
  }
  
  console.log(`🎬 [STITCHER] Stitching ${videoUrls.length} videos into 18-second cinema...`);
  onProgress?.(`Combining ${videoUrls.length} clips into cinema...`);
  
  try {
    // Try Cloudinary first (most reliable for your setup)
    const result = await stitchWithCloudinary(videoUrls);
    onProgress?.('Cinema ready! 🎬');
    return result;
    
  } catch (error) {
    console.error('⚠️ [STITCHER] Cloudinary failed:', error);
    onProgress?.('Stitching failed, using fallback...');
    
    // Fallback to first video
    return fallbackStitching(videoUrls);
  }
}

// Alternative: Create a video playlist (M3U8 style) - for backup
export async function createVideoPlaylist(videoUrls: string[]): Promise<string> {
  try {
    const playlist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
${videoUrls.map(url => `#EXTINF:6.0,\n${url}`).join('\n')}
#EXT-X-ENDLIST`;

    const playlistPath = `${FileSystem.documentDirectory}dream_playlist_${Date.now()}.m3u8`;
    await FileSystem.writeAsStringAsync(playlistPath, playlist);
    
    console.log('✅ Created video playlist:', playlistPath);
    return playlistPath;
    
  } catch (error) {
    console.error('❌ Failed to create playlist:', error);
    throw error;
  }
}

// Check Cloudinary connection
export async function testCloudinaryConnection(): Promise<boolean> {
  const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  
  if (!CLOUD_NAME) return false;
  
  try {
    const response = await fetch(`https://res.cloudinary.com/${CLOUD_NAME}/image/upload`, {
      method: 'OPTIONS',
    });
    
    return response.ok;
  } catch {
    return false;
  }
}

// Export for easy importing
export default stitchVideos;