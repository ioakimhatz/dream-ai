// app/utils/stillsAnchors.ts
import { uploadImageToCloudinary } from "./cloudinaryUpload";
import { getOrCreateIdentityImageUrl } from "./identityLock";

// Provider toggle: "fal" (default) or "nano" (via your own proxy)
const STILLS_PROVIDER = (process.env.EXPO_PUBLIC_STILLS_PROVIDER || "fal").toLowerCase();
const NANO_PROXY = process.env.EXPO_PUBLIC_NANO_PROXY || ""; // e.g. https://your-domain/api/nano/anchors

const FAL_KEY =
  process.env.EXPO_PUBLIC_FAL_API_KEY_1 ||
  process.env.EXPO_PUBLIC_FAL_API_KEY ||
  process.env.EXPO_PUBLIC_FAL_KEY ||
  "";

function pickImageUrl(json: any): string | null {
  if (!json) return null;
  if (typeof json === "string") return json;
  return (
    json.image?.url ??
    json.images?.[0]?.url ??
    json.data?.image?.url ??
    json.url ??
    null
  );
}

// ---- FAL IP-Adapter: face_image_url (single) -> image ----
async function ipAdapterFaceId(opts: {
  prompt: string;
  faceImageUrl: string;      // http(s) or data:image;base64
  width?: number;
  height?: number;
  steps?: number;
  guidance?: number;
  negative?: string;
}): Promise<string> {
  const {
    prompt,
    faceImageUrl,
    width = 1024,
    height = 1024,
    steps = 40,
    guidance = 7.0,
    negative = "blurry, low resolution, pixelated, text, watermark, extra limbs, deformed, doll-like skin, bad anatomy",
  } = opts;

  if (!FAL_KEY) throw new Error("[stills] Missing FAL key");

  const res = await fetch("https://fal.run/fal-ai/ip-adapter-face-id", {
    method: "POST",
    headers: { Authorization: `Key ${FAL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      negative_prompt: negative,
      width,
      height,
      num_inference_steps: steps,
      guidance_scale: guidance,
      face_image_url: faceImageUrl, // ✅ correct field
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`ip-adapter ${res.status}: ${t}`);
  }

  const j = await res.json();
  const url = pickImageUrl(j);
  if (!url) throw new Error("ip-adapter: missing image url");
  return url;
}

// ---- Optional: NanoBanana via your serverless proxy (keeps key off device) ----
// Proxy contract (you host):
// POST NANO_PROXY { acts: string[], faceUrl: string } -> { stills: string[3] } (https URLs)
async function nanoProxyAnchors(acts: [string, string, string], faceLocalUri: string): Promise<string[]> {
  if (!NANO_PROXY) throw new Error("EXPO_PUBLIC_NANO_PROXY not set (required for STILLS_PROVIDER=nano).");

  // host the face so your proxy can fetch it
  const faceUrl = await uploadImageToCloudinary(faceLocalUri);

  const res = await fetch(NANO_PROXY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acts, faceUrl }),
  });
  if (!res.ok) throw new Error(`nano proxy ${res.status}: ${await res.text()}`);

  const j = await res.json();
  if (!Array.isArray(j?.stills) || j.stills.length < 3) throw new Error("nano proxy: bad response");
  return [j.stills[0], j.stills[1], j.stills[2]];
}

export async function createActStills(opts: {
  acts: [string, string, string];
  localFaceImageUri: string;       // from ImagePicker (bg already removed is great)
}): Promise<{ stills: [string, string, string] }> {
  const { acts, localFaceImageUri } = opts;

  if (STILLS_PROVIDER === "nano") {
    try {
      const stills = await nanoProxyAnchors(acts, localFaceImageUri);
      return { stills: [stills[0], stills[1], stills[2]] as [string, string, string] };
    } catch (e) {
      console.warn("⚠️ Nano proxy failed; falling back to FAL IP-Adapter.", e);
    }
  }

  // FAL fallback (works fully on-device; FAL key is public here like Kling)
  const faceDataUrl = await getOrCreateIdentityImageUrl(localFaceImageUri);
  const bake = (p: string) =>
    `${p}. The SAME adult person is clearly visible (front/three-quarter), realistic live-action key art; no text.`;

  const [a, b, c] = await Promise.all([
    ipAdapterFaceId({ prompt: bake(acts[0]), faceImageUrl: faceDataUrl }),
    ipAdapterFaceId({ prompt: bake(acts[1]), faceImageUrl: faceDataUrl }),
    ipAdapterFaceId({ prompt: bake(acts[2]), faceImageUrl: faceDataUrl }),
  ]);

  return { stills: [a, b, c] };
}
