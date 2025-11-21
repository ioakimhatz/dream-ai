// functions/src/utils/cloudinaryUpload.ts - SERVER VERSION (Node.js compatible)
// NOW USES BUNNY CDN - NO expo-file-system (Cloud Functions compatible)

// Node.js native modules only
const BUNNY_API_KEY = process.env.BUNNY_API_KEY || '';
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || 'dreamai';
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || 'dreamai.b-cdn.net';
const BUNNY_HOSTNAME = process.env.BUNNY_HOSTNAME || 'storage.bunnycdn.com';

/**
 * Upload image to Bunny CDN (Server-Side Version)
 *
 * MIGRATION NOTE: This function now uses Bunny CDN instead of Cloudinary
 * Function signature unchanged for backward compatibility
 *
 * IMPORTANT: This is the SERVER version for Cloud Functions (Node.js)
 * - Uses native fetch() and Buffer (Node.js 18+)
 * - Does NOT use expo-file-system (incompatible with Cloud Functions)
 *
 * For CLIENT version (React Native), see: app/utils/cloudinaryUpload.ts
 *
 * @param localUri - Image source: URL (http/https), base64 (data:), or file path
 * @returns CDN URL of uploaded image (from Bunny CDN)
 */
export async function uploadImageToCloudinary(localUri: string): Promise<string> {
  console.log('🔄 [Migration] uploadImageToCloudinary now using Bunny CDN (Server)');
  console.log('📤 [Bunny] Uploading from:', localUri.substring(0, 50) + '...');

  try {
    // Generate remote filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const remoteName = `face_${timestamp}_${randomId}.jpg`;
    const remotePath = `user-images/${remoteName}`;

    // Prepare file buffer based on input type
    let fileBuffer: Buffer;

    if (localUri.startsWith('http://') || localUri.startsWith('https://')) {
      // Download from URL using native fetch
      console.log('📥 [Bunny] Downloading from URL...');
      const response = await fetch(localUri);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);

    } else if (localUri.startsWith('data:')) {
      // Extract base64 from data URI
      console.log('📋 [Bunny] Processing base64 data URI...');
      const base64Data = localUri.includes(',') ? localUri.split(',')[1] : localUri;
      fileBuffer = Buffer.from(base64Data, 'base64');

    } else {
      // Assume it's raw base64 string (no data: prefix)
      console.log('📋 [Bunny] Processing raw base64...');
      fileBuffer = Buffer.from(localUri, 'base64');
    }

    // Upload to Bunny Storage
    const uploadUrl = `https://${BUNNY_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${remotePath}`;
    console.log('📤 [Bunny] Uploading to:', uploadUrl);

    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_API_KEY,
        'Content-Type': 'image/jpeg',
        'Content-Length': fileBuffer.length.toString(),
      },
      body: fileBuffer as any, // Node.js Buffer is compatible with fetch body
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`Bunny upload failed (${uploadResponse.status}): ${errorText}`);
    }

    // Return CDN URL
    const cdnUrl = `https://${BUNNY_CDN_HOSTNAME}/${remotePath}`;
    console.log('✅ [Bunny] Upload successful:', cdnUrl);
    return cdnUrl;

  } catch (error: any) {
    console.error('❌ [Bunny] Upload failed:', error);
    throw new Error(`Bunny CDN upload error: ${error.message}`);
  }
}

/**
 * Alternative: Direct upload from base64 (simpler API)
 *
 * @param base64Data - Raw base64 string (without data: prefix)
 * @param filename - Optional custom filename
 * @returns CDN URL of uploaded image
 */
export async function uploadImageFromBase64(
  base64Data: string,
  filename?: string
): Promise<string> {
  console.log('📤 [Bunny] Direct base64 upload...');

  const remoteName = filename || `image_${Date.now()}.jpg`;
  const remotePath = `user-images/${remoteName}`;

  // Convert base64 to Buffer
  const fileBuffer = Buffer.from(base64Data, 'base64');

  // Upload to Bunny Storage
  const uploadUrl = `https://${BUNNY_HOSTNAME}/${BUNNY_STORAGE_ZONE}/${remotePath}`;

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'AccessKey': BUNNY_API_KEY,
      'Content-Type': 'image/jpeg',
      'Content-Length': fileBuffer.length.toString(),
    },
    body: fileBuffer as any, // Node.js Buffer is compatible with fetch body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Bunny upload failed (${response.status}): ${errorText}`);
  }

  const cdnUrl = `https://${BUNNY_CDN_HOSTNAME}/${remotePath}`;
  console.log('✅ [Bunny] Upload successful:', cdnUrl);
  return cdnUrl;
}

console.log('✅ cloudinaryUpload.ts loaded (Server) - USING BUNNY CDN (Node.js compatible)');
