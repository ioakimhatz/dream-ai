// app/utils/cloudinaryUpload.ts
import * as FileSystem from "expo-file-system";
import * as ImageManipulator from 'expo-image-manipulator';

const CLOUD = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

type UploadResp = { secure_url: string };

export async function uploadImageToCloudinary(localUri: string): Promise<string> {
  if (!CLOUD || !PRESET) {
    throw new Error("Missing Cloudinary env vars (cloud name / unsigned preset).");
  }

  let uploadUri = localUri;
  if (localUri.toLowerCase().endsWith('.png')) {
    const result = await ImageManipulator.manipulateAsync(
      localUri,
      [],
      { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
    );
    uploadUri = result.uri;
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`;

  const form = new FormData();
  form.append("upload_preset", PRESET);
  form.append(
    "file",
    { uri: uploadUri, name: "image.jpg", type: "image/jpeg" } as any
  );

  const res = await fetch(endpoint, { method: "POST", body: form as any });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Cloudinary image upload failed ${res.status}: ${t}`);
  }
  const json = (await res.json()) as UploadResp;
  return json.secure_url;
}

export async function downloadToLocal(url: string): Promise<string> {
  const out = `${FileSystem.documentDirectory}dl_${Date.now()}.bin`;
  const dl = await FileSystem.downloadAsync(url, out);
  return dl.uri;
}