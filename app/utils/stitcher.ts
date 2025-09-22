// app/utils/stitcher.ts
import * as FileSystem from "expo-file-system";

const CLOUD = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

type OnProgress = (msg: string) => void;

type UploadResponse = {
  public_id: string;
};

function assertEnv() {
  if (!CLOUD) throw new Error("Missing EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME");
  if (!PRESET) throw new Error("Missing EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET");
}

/**
 * Upload a local file:// (or remote https://) to Cloudinary using an **unsigned** preset.
 * Returns the Cloudinary public_id (no extension).
 */
async function uploadToCloudinary(src: string): Promise<string> {
  assertEnv();

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD}/video/upload`;
  const form = new FormData();
  form.append("upload_preset", PRESET);

  if (src.startsWith("file://")) {
    // Attach as a file (avoids base64 memory bloat)
    form.append(
      "file",
      {
        uri: src,
        name: "clip.mp4",
        type: "video/mp4",
      } as any
    );
  } else {
    // Remote URL can be sent directly
    form.append("file", src);
  }

  const res = await fetch(endpoint, { method: "POST", body: form as any });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Cloudinary upload failed ${res.status}: ${txt}`);
  }
  const json = (await res.json()) as UploadResponse;
  if (!json.public_id) throw new Error("Cloudinary response missing public_id");
  return json.public_id;
}

/**
 * Build a Cloudinary splice URL that concatenates three uploaded video public_ids
 * in the given order: id0 + id1 + id2.
 */
function buildSpliceUrl([id0, id1, id2]: [string, string, string]): string {
  const enc = (s: string) => encodeURIComponent(s);
  const base = `https://res.cloudinary.com/${CLOUD}/video/upload`;
  // order: overlay id1 then splice, overlay id2 then splice, play id0 as the base
  return `${base}/l_video:${enc(id1)},fl_splice/l_video:${enc(id2)},fl_splice/${enc(id0)}.mp4`;
}

/**
 * Stitches three clips (file:// or https://) by:
 *  1) uploading each to Cloudinary (unsigned)
 *  2) building the splice transformation URL
 *  3) optionally downloading the stitched result locally
 *
 * @param clips    exactly 3 clip URIs
 * @param onProgress optional progress logger
 * @param download if true (default) returns file:// local path; if false returns https URL
 */
export async function stitchClips(
  clips: [string, string, string],
  onProgress?: OnProgress,
  download: boolean = true
): Promise<string> {
  assertEnv();

  if (!Array.isArray(clips) || clips.length !== 3) {
    throw new Error("Expect exactly 3 clips");
  }

  onProgress?.("Uploading clip 1/3…");
  const id0 = await uploadToCloudinary(clips[0]);

  onProgress?.("Uploading clip 2/3…");
  const id1 = await uploadToCloudinary(clips[1]);

  onProgress?.("Uploading clip 3/3…");
  const id2 = await uploadToCloudinary(clips[2]);

  const stitchedUrl = buildSpliceUrl([id0, id1, id2]);
  onProgress?.("Building final URL…");

  if (!download) return stitchedUrl;

  const outPath = `${FileSystem.documentDirectory}dream_stitched_${Date.now()}.mp4`;
  const dl = await FileSystem.downloadAsync(stitchedUrl, outPath);
  return dl.uri; // file:///.../dream_stitched_xxx.mp4
}

/**
 * Convenience: pass local file paths already on disk, get a local stitched file back.
 */
export async function stitchLocalFiles(
  clip1FileUri: string,
  clip2FileUri: string,
  clip3FileUri: string,
  onProgress?: OnProgress
): Promise<string> {
  return stitchClips([clip1FileUri, clip2FileUri, clip3FileUri], onProgress, true);
}
