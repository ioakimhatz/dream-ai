// app/utils/cloudinaryStitch.ts
import * as FileSystem from "expo-file-system";

const CLOUD = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

type UploadResp = { public_id: string };

async function uploadClip(localUri: string): Promise<string> {
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD}/video/upload`;
  const form = new FormData();
  form.append("upload_preset", PRESET);
  // NOTE: iOS local file:// URIs are fine to send directly
  form.append("file", { uri: localUri, name: "clip.mp4", type: "video/mp4" } as any);

  const res = await fetch(endpoint, { method: "POST", body: form as any });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Cloudinary upload failed ${res.status}: ${text}`);
  }
  const json = (await res.json()) as UploadResp;
  return json.public_id; // e.g. yy2zo0z93mbivh5lu24l
}

function buildSpliceUrl(publicIds: string[]): string {
  if (publicIds.length === 0) throw new Error("No public IDs to stitch");
  const [first, ...rest] = publicIds;
  // Build: /fl_splice,l_video:<id2>/fl_splice,l_video:<id3>/<id1>.mp4
  const tail = rest.map(id => `fl_splice,l_video:${id}`).join("/");
  const path = tail ? `${tail}/${first}.mp4` : `${first}.mp4`;
  return `https://res.cloudinary.com/${CLOUD}/video/upload/${path}`;
}

/**
 * Uploads local mp4 clips to Cloudinary using an UNSIGNED preset and returns either:
 *  - the stitched remote URL, or
 *  - a downloaded local file path if download=true
 */
export async function stitchWithCloudinary(
  localClipPaths: string[],
  download: boolean = true
): Promise<string> {
  if (!CLOUD || !PRESET) {
    throw new Error("Missing Cloudinary env vars (cloud name or unsigned preset).");
  }

  // 1) Upload each local clip
  const ids: string[] = [];
  for (const p of localClipPaths) {
    const id = await uploadClip(p);
    ids.push(id);
  }

  // 2) Build splice URL (concatenate in order)
  const finalUrl = buildSpliceUrl(ids);

  // 3) (Optional) Download to device so your player reads a local file
  if (!download) return finalUrl;

  const outPath = `${FileSystem.documentDirectory}dream_stitched_${Date.now()}.mp4`;
  const dl = await FileSystem.downloadAsync(finalUrl, outPath);
  return dl.uri; // file:///.../dream_stitched_XXXX.mp4
}
