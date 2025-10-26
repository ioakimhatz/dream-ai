// app/utils/characterBinder.ts
import * as fal from "@fal-ai/serverless-client";
import { uploadImageToCloudinary } from "./cloudinaryUpload";

fal.config({
  credentials: process.env.EXPO_PUBLIC_FAL_KEY || process.env.EXPO_PUBLIC_FAL_API_KEY_1,
});

interface CharacterRefs {
  frontView: string;
  sideView: string;
  actionPose: string;
  originalFace: string;
}

export async function prepareCharacterForKling(
  faceImageUri: string,
  method: "instantid" | "ip-adapter" | "photomaker" = "instantid"
): Promise<string> {
  const cloudinaryUrl = await uploadImageToCloudinary(faceImageUri);

  let referenceImageUrl: string;

  switch (method) {
    case "instantid":
      referenceImageUrl = await prepareWithInstantID(cloudinaryUrl);
      break;
    case "ip-adapter":
      referenceImageUrl = await prepareWithIPAdapter(cloudinaryUrl);
      break;
    case "photomaker":
      referenceImageUrl = await prepareWithPhotoMaker(cloudinaryUrl);
      break;
    default:
      throw new Error(`Unknown method: ${method}`);
  }

  return referenceImageUrl;
}

async function prepareWithInstantID(faceImageUrl: string): Promise<string> {
  const result: any = await fal.subscribe("fal-ai/fast-sdxl", {
    input: {
      prompt: "Professional cinematic portrait photograph of a person, front view, neutral expression, soft professional lighting, photorealistic, highly detailed face, 8k quality, film photography",
      image_url: faceImageUrl,
      negative_prompt: "blurry, distorted, disfigured, bad anatomy, ugly, deformed, cartoon, anime, illustration, painting",
      num_images: 1,
      guidance_scale: 7.5,
      num_inference_steps: 30,
      enable_safety_checker: false,
    },
  });
  return result.images[0].url;
}

async function prepareWithIPAdapter(faceImageUrl: string): Promise<string> {
  const result: any = await fal.subscribe("fal-ai/ip-adapter-face-id", {
    input: {
      prompt: "Cinematic character portrait, photorealistic, professional lighting, highly detailed face",
      face_image_url: faceImageUrl,
      num_images: 1,
      width: 1024,
      height: 1024,
      num_inference_steps: 40,
      guidance_scale: 7.0,
    },
  });
  return result.images[0].url;
}

async function prepareWithPhotoMaker(faceImageUrl: string): Promise<string> {
  const result: any = await fal.subscribe("fal-ai/photomaker", {
    input: {
      prompt: "Professional photo of a person, cinematic lighting, high quality, detailed face",
      input_images: [faceImageUrl],
      num_images: 1,
      style: "Photographic (Default)",
    },
  });
  return result.images[0].url;
}

export async function prepareCharacterReference(
  faceImageUri: string,
  options: { numPoses?: number; style?: string } = {}
): Promise<CharacterRefs> {
  const cloudinaryUrl = await uploadImageToCloudinary(faceImageUri);
  const style = options.style || "cinematic";
  const prompts = [
    `${style} portrait, front view, neutral expression, soft lighting`,
    `${style} portrait, side profile, looking forward, professional lighting`,
    `${style} shot, dynamic action pose, cinematic lighting, full body`,
  ];

  const results = await Promise.all(
    prompts.map(async (prompt) => {
      const result: any = await fal.subscribe("fal-ai/fast-sdxl", {
        input: {
          prompt,
          image_url: cloudinaryUrl,
          negative_prompt: "blurry, distorted, disfigured, bad anatomy, ugly",
          num_images: 1,
          guidance_scale: 7.5,
          num_inference_steps: 25,
          enable_safety_checker: false,
        },
      });
      return result.images[0].url;
    })
  );

  return {
    frontView: results[0],
    sideView: results[1],
    actionPose: results[2],
    originalFace: cloudinaryUrl,
  };
}

export async function generateVideoWithCharacter(
  scenePrompt: string,
  characterRefs: CharacterRefs
): Promise<string> {
  const enhancedPrompt = `${scenePrompt}. Character appearance: photorealistic human, maintaining exact facial features from reference image.`;
  const result: any = await fal.subscribe("fal-ai/hailuo/video", {
    input: {
      prompt: enhancedPrompt,
      image_url: characterRefs.frontView,
      duration: "5",
      aspect_ratio: "9:16",
    },
  });
  return result.video.url;
}