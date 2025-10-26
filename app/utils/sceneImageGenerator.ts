// app/utils/sceneImageGenerator.ts - FINAL VERSION
import { uploadImageToCloudinary } from "./cloudinaryUpload";

const FAL_KEY = 
  process.env.EXPO_PUBLIC_FAL_KEY || 
  process.env.EXPO_PUBLIC_FAL_API_KEY_1 || 
  process.env.EXPO_PUBLIC_FAL_API_KEY;

/**
 * Generate a scene image with one or more faces
 * @param faceImageUris - Single URI or array of local face image URIs (supports 1-3 faces)
 * @param actPrompt - Scene description prompt
 * @returns URL of generated scene image
 */
export async function generateSceneImage(
  faceImageUris: string | string[],
  actPrompt: string
): Promise<string> {
  console.log("🎨 Nano Banana:", actPrompt);

  try {
    // Convert single URI to array for consistent handling
    const urisArray = Array.isArray(faceImageUris) ? faceImageUris : [faceImageUris];
    
    // Upload all faces to Cloudinary in parallel
    console.log(`📤 Uploading ${urisArray.length} face(s) to Cloudinary...`);
    const uploadPromises = urisArray.map(uri => uploadImageToCloudinary(uri));
    const faceUrls = await Promise.all(uploadPromises);
    
    console.log(`✅ Uploaded ${faceUrls.length} face URL(s):`, faceUrls);

    if (!FAL_KEY) {
      throw new Error("No FAL API key configured");
    }

    // NanoBanana API call with multiple faces
    const response = await fetch("https://fal.run/fal-ai/nano-banana/edit", {
      method: "POST",
      headers: {
        "Authorization": `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: actPrompt,
        image_urls: faceUrls,
        num_images: 1,
        output_format: "jpeg",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error:", response.status, errorText);
      throw new Error(`Nano Banana API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log("📦 Result:", result);

    if (!result.images?.[0]?.url) {
      throw new Error("No image URL in response");
    }

    console.log("✅ Scene generated with", faceUrls.length, "character(s)");
    return result.images[0].url;
  } catch (err: any) {
    console.error("❌ Full error:", err);
    throw new Error(`Scene failed: ${err.message}`);
  }
}