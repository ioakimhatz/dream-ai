// functions/src/utils/cloudinaryStitch.ts - NOW USES BUNNY CDN
// Kept same function names for backward compatibility
import { stitchWithBunny, uploadImageToBunny } from './bunnyUpload';

/**
 * Stitch video clips and upload to Bunny CDN
 * 
 * MIGRATION NOTE: This function now uses Bunny CDN instead of Cloudinary
 * Function signature unchanged for backward compatibility
 * 
 * @param localClipPaths - Array of local video file paths to stitch
 * @returns CDN URL of the final stitched video (now from Bunny CDN)
 */
export async function stitchWithCloudinary(localClipPaths: string[]): Promise<string> {
  console.log('🔄 [Migration] stitchWithCloudinary now using Bunny CDN');
  return stitchWithBunny(localClipPaths);
}

/**
 * Upload image to Bunny CDN
 * 
 * MIGRATION NOTE: This function now uses Bunny CDN instead of Cloudinary
 * Function signature unchanged for backward compatibility
 * 
 * @param localUri - Local image file path
 * @returns CDN URL of the uploaded image (now from Bunny CDN)
 */
export async function uploadImage(localUri: string): Promise<string> {
  console.log('🔄 [Migration] uploadImage now using Bunny CDN');
  return uploadImageToBunny(localUri);
}

// Export Bunny functions directly for new code
export { stitchWithBunny, uploadImageToBunny } from './bunnyUpload';

console.log('✅ cloudinaryStitch.ts loaded - NOW USING BUNNY CDN');