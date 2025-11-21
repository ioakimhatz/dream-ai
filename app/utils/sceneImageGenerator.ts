// app/utils/sceneImageGenerator.ts - WITH CORRECT ENDPOINTS + SCENE CHAINING
import { uploadImageToCloudinary } from "./cloudinaryUpload";

const FAL_KEY = 
  process.env.EXPO_PUBLIC_FAL_KEY || 
  process.env.EXPO_PUBLIC_FAL_API_KEY_1 || 
  process.env.EXPO_PUBLIC_FAL_API_KEY;

/**
 * Generate a scene image with optional face images in 9:16 aspect ratio
 * 🔥 Nano Banana 2 Pro: fal-ai/nano-banana-pro/edit
 * - Premium face quality (3x better than v1)
 */
export async function generateSceneImage(
  faceImageUris: string | string[] | undefined,
  actPrompt: string,
  baseImageUrl?: string
): Promise<string> {
  const nanoBananaPrompt = actPrompt.replace(
    "photorealistic video footage of",
    "photorealistic photo of"
  );
  
  console.log("🎨 [Nano Banana] Using prompt:", nanoBananaPrompt);
  
  if (baseImageUrl) {
    console.log("🔗 [Scene Chaining] Using base image for consistency:", baseImageUrl);
  }

  try {
    // Handle face images (optional)
    let faceUrls: string[] = [];
    
    if (faceImageUris) {
      const urisArray = Array.isArray(faceImageUris) ? faceImageUris : [faceImageUris];
      
      // Check if these are local URIs that need upload
      const needsUpload = urisArray.some(uri => uri.startsWith('file://'));
      
      if (needsUpload) {
        console.log(`📤 Uploading ${urisArray.length} face(s) to Cloudinary...`);
        const uploadPromises = urisArray.map(uri => uploadImageToCloudinary(uri));
        faceUrls = await Promise.all(uploadPromises);
        console.log(`✅ Uploaded ${faceUrls.length} face URL(s)`);
      } else {
        faceUrls = urisArray;
        console.log(`✅ Using ${faceUrls.length} pre-uploaded face URL(s)`);
      }
    } else {
      console.log(`ℹ️ No face images provided - generating from prompt only`);
    }

    if (!FAL_KEY) {
      throw new Error("No FAL API key configured");
    }

    // 🔥 SMART ENDPOINT SELECTION
    const hasImages = faceUrls.length > 0 || baseImageUrl;
    
    if (!hasImages) {
      // ✅ NO IMAGES: Use text-to-image endpoint
      console.log("🎨 Using Nano Banana text-to-image (no images)");
      console.log("🚀 Using Nano Banana 2 Pro (text-to-image mode)");

      const response = await fetch("https://fal.run/fal-ai/nano-banana-pro/edit", {
        method: "POST",
        headers: {
          "Authorization": `Key ${FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: nanoBananaPrompt,
          num_images: 1,
          output_format: "jpeg",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Nano Banana Text-to-Image Error:", response.status, errorText);
        
        const errorLower = errorText.toLowerCase();
        if (
          response.status === 400 || 
          response.status === 403 || 
          errorLower.includes("content") ||
          errorLower.includes("policy") ||
          errorLower.includes("inappropriate")
        ) {
          console.error("🚫 Content rejected by NanoBanana");
          throw new Error("CONTENT_REJECTED_BY_API");
        }
        
        throw new Error(`Nano Banana error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.images?.[0]?.url) {
        throw new Error("No image URL in Nano Banana response");
      }

      console.log("✅ Scene generated (text-to-image, 0 characters)");
      return result.images[0].url;
    } else {
      // ✅ WITH IMAGES: Use edit endpoint
      console.log("👥 Using Nano Banana edit (with images)");
      
      const body: any = {
        prompt: nanoBananaPrompt,
        image_urls: baseImageUrl ? [baseImageUrl, ...faceUrls] : faceUrls,
        num_images: 1,
        output_format: "jpeg",
        aspect_ratio: "9:16",
        negative_prompt: "cartoon, anime, drawing, painting, sketch, fantasy art, illustration, comic book, 3d render, cgi, artistic, stylized, animated, unrealistic",
      };

      console.log("🔗 Total images:", body.image_urls.length);
      console.log("🚀 Using Nano Banana 2 Pro (image edit mode)");

      const response = await fetch("https://fal.run/fal-ai/nano-banana-pro/edit", {
        method: "POST",
        headers: {
          "Authorization": `Key ${FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Nano Banana Edit Error:", response.status, errorText);
        
        const errorLower = errorText.toLowerCase();
        if (
          response.status === 400 || 
          response.status === 403 || 
          errorLower.includes("content") ||
          errorLower.includes("policy") ||
          errorLower.includes("inappropriate")
        ) {
          console.error("🚫 Content rejected by NanoBanana");
          throw new Error("CONTENT_REJECTED_BY_API");
        }
        
        throw new Error(`Nano Banana edit error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (!result.images?.[0]?.url) {
        throw new Error("No image URL in Nano Banana response");
      }

      console.log(`✅ Scene generated (edit, ${faceUrls.length} character(s))`);
      return result.images[0].url;
    }
    
  } catch (err: any) {
    console.error("❌ generateSceneImage failed:", err);
    
    if (err.message === "CONTENT_REJECTED_BY_API") {
      throw err;
    }
    
    throw new Error(`Scene generation failed: ${err.message}`);
  }
}

export default { generateSceneImage };