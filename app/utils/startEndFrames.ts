// app/utils/startEndFrames.ts
// Generate THREE identity anchors (start, mid, end) with IP-Adapter Face-ID on FAL.
// IMPORTANT: we use `face_image_url` (single image), matching FAL schema.

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

async function ipAdapterFaceId(opts: {
  prompt: string;            // still image description (match act setting)
  faceImageUrl: string;      // http(s) or data:image/...;base64
  width?: number;            // default 1024
  height?: number;           // default 1024
  steps?: number;            // default 40
  guidance?: number;         // default 7.0
  negative?: string;         // default strong negatives
}): Promise<string> {
  const {
    prompt,
    faceImageUrl,
    width = 1024,
    height = 1024,
    steps = 40,
    guidance = 7.0,
    negative = "blurry, low resolution, low quality, pixelated, text, watermark, extra limbs, deformed, doll-like skin, bad anatomy",
  } = opts;

  if (!FAL_KEY) throw new Error("[IP-Adapter] Missing FAL key");

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

/** Build three identity-consistent stills for acts 1/2/3. */
export async function createThreeAnchors(opts: {
  actPrompts: [string, string, string];
  identityImageUrl: string; // http(s) or data:image;base64
}): Promise<{ startUrl: string; midUrl: string; endUrl: string }> {
  const { actPrompts, identityImageUrl } = opts;

  const safePrompt = (p: string) =>
    `${p}. The SAME adult person is clearly visible, realistic live-action, cinematic key art.`;

  const [startUrl, midUrl, endUrl] = await Promise.all([
    ipAdapterFaceId({ prompt: safePrompt(actPrompts[0]), faceImageUrl: identityImageUrl }),
    ipAdapterFaceId({ prompt: safePrompt(actPrompts[1]), faceImageUrl: identityImageUrl }),
    ipAdapterFaceId({ prompt: safePrompt(actPrompts[2]), faceImageUrl: identityImageUrl }),
  ]);

  return { startUrl, midUrl, endUrl };
}
