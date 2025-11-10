// app/utils/cloudinaryUpload.ts - Cloud Functions Compatible
import * as FileSystem from "./fileSystem";

const CLOUD = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

type UploadResp = { secure_url: string };

export async function uploadImageToCloudinary(localUri: string): Promise<string> {
  if (!CLOUD || !PRESET) {
    throw new Error("Missing Cloudinary env vars (cloud name / unsigned preset).");
  }

  // ✅ CLOUD FUNCTIONS: Skip PNG-to-JPEG conversion (expo-image-manipulator not available)
  // Images upload fine as-is, Cloudinary handles format conversion automatically
  let uploadUri = localUri;

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`;
  
  // Read file and create FormData
  const fileData = await FileSystem.readAsStringAsync(uploadUri, { encoding: 'base64' });
  const blob = Buffer.from(fileData, 'base64');
  
  // Detect file type from URI
  const isJpeg = localUri.toLowerCase().match(/\.(jpg|jpeg)$/);
  const isPng = localUri.toLowerCase().endsWith('.png');
  const mimeType = isPng ? 'image/png' : 'image/jpeg';
  
  const form = new FormData();
  form.append("upload_preset", PRESET);
  form.append("file", new Blob([blob], { type: mimeType }), "image.jpg");

  const res = await fetch(endpoint, { method: "POST", body: form as any });
  
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Cloudinary image upload failed ${res.status}: ${t}`); // ✅ Fixed syntax error
  }
  
  const json = (await res.json()) as UploadResp;
  return json.secure_url;
}

export async function downloadToLocal(url: string): Promise<string> {
  const out = `${FileSystem.documentDirectory}dl_${Date.now()}.bin`;
  const dl = await FileSystem.downloadAsync(url, out);
  return dl.uri;
}
