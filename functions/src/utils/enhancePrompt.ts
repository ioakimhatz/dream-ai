// app/utils/enhancePrompt.ts - NATURAL VARIATIONS (No Rigid Templates!)
export type ScenePlan = {
  acts: [string, string, string];
  basePrompt: string;
};

// 🔥 NEW: 2-clip dreamcore plan (10s + 5s)
export type DreamcorePlan = {
  act1: string;  // 10 second clip
  act2: string;  // 5 second clip
  basePrompt: string;
};

/**
 * 🎯 NEW APPROACH: Create NATURAL variations without rigid templates
 * 
 * OLD (broken): Added "photorealistic video footage", "golden hour lighting", "NOT animated", etc.
 * NEW (fixed): Keep it simple and natural, let the models do their magic!
 * 
 * INPUT: Clean prompt from smartPromptProcessor (e.g., "person riding motorcycle with woman")
 * OUTPUT: 3 natural scene variations that flow together
 */
export async function getScenePlan(cleanPrompt: string): Promise<ScenePlan> {
  console.log("🎬 Creating 3 natural scene variations");
  console.log("📥 Input clean prompt:", cleanPrompt);
  
  // Try OpenAI for intelligent variations
  const openaiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  
  if (openaiKey) {
    try {
      const intelligentPlan = await createIntelligentVariations(cleanPrompt, openaiKey);
      console.log("✅ Created intelligent variations with OpenAI");
      return intelligentPlan;
    } catch (error) {
      console.warn("⚠️ OpenAI failed, using fallback variations:", error);
    }
  }
  
  // Fallback: Simple natural variations
  const fallbackPlan = createSimpleVariations(cleanPrompt);
  console.log("✅ Created simple natural variations (fallback)");
  return fallbackPlan;
}

/**
 * Use OpenAI to create intelligent, natural scene variations
 */
async function createIntelligentVariations(cleanPrompt: string, openaiKey: string): Promise<ScenePlan> {
  const system = `You are a cinematic storytelling expert. Create 3 scene variations that PRESERVE ALL DETAILS from the input.

🚨 CRITICAL RULES:

1. PRESERVE EVERY DETAIL:
   - If input mentions "tall heels" → ALL 3 scenes must include tall heels
   - If input mentions "motorcycle" → ALL 3 scenes must include motorcycle
   - If input mentions "glowing creatures" → ALL 3 scenes must include glowing creatures
   - If input mentions "getting taller" → Show the progression of getting taller
   - NEVER drop or change the specific details the user mentioned!

2. CREATE PROGRESSION, NOT NEW SCENES:
   - Don't rewrite the scene with different actions
   - Keep the SAME elements, just show them at different moments
   - Scene 1: Beginning/setup of the action
   - Scene 2: Main action happening
   - Scene 3: Result/aftermath of the action

3. MATCH INPUT LENGTH:
   - If input is 10 words, output ~10 words per scene
   - If input is 20 words, output ~20 words per scene
   - Don't make scenes shorter than the input!

4. STAY SIMPLE:
   - NO technical terms (no "photorealistic", "cinematic", etc.)
   - NO lighting instructions (no "golden hour", "dramatic lighting")
   - Just describe WHAT happens, keeping ALL the details

Return JSON: {"acts": ["scene1", "scene2", "scene3"]}

✅ GOOD EXAMPLES (Preserving Details):

Input: "person kissing woman in park, having great time, woman wearing tall heels"
Output:
{
  "acts": [
    "person and woman together in park having great time, woman wearing tall heels",
    "person kissing woman in park, woman in tall heels standing taller",
    "person and woman after kiss in park, woman in tall heels towering over person"
  ]
}
Why good: Kept "tall heels" in ALL 3 scenes, showed progression

Input: "person in Agartha with glowing creatures exploring crystal caves"
Output:
{
  "acts": [
    "person entering Agartha with glowing creatures near crystal caves",
    "person in Agartha with glowing creatures exploring deep into crystal caves",
    "person in Agartha surrounded by glowing creatures in crystal caves"
  ]
}
Why good: Kept ALL details (Agartha, glowing creatures, crystal caves) in every scene

Input: "person riding motorcycle with woman through city at night with neon lights"
Output:
{
  "acts": [
    "person starting motorcycle ride with woman through city at night with neon lights",
    "person riding motorcycle with woman through bright neon-lit city at night",
    "person arriving on motorcycle with woman in neon-lit city at night"
  ]
}
Why good: Kept motorcycle, woman, city, night, neon lights in ALL scenes

❌ BAD EXAMPLES (Dropping Details):

Input: "person kissing woman in park, having great time, woman wearing tall heels"
Bad Output:
{
  "acts": [
    "person and woman walking hand in hand in vibrant park",
    "person and woman laughing together sharing sweet kiss",
    "person and woman sitting on bench smiling"
  ]
}
Why bad: DROPPED "tall heels" completely! Rewrote the scene entirely!

Input: "person in Agartha with glowing creatures exploring crystal caves"
Bad Output:
{
  "acts": [
    "person discovering ancient ruins",
    "person exploring mysterious location",
    "person witnessing strange phenomena"
  ]
}
Why bad: DROPPED all specific details (Agartha, glowing creatures, crystal caves)!

🎯 DECISION PROCESS:
1. Read input carefully - identify ALL specific details
2. List the key elements that MUST appear in every scene
3. Create 3 moments showing progression of the SAME scene
4. Verify EVERY detail from input appears in EVERY output scene`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${openaiKey}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Create 3 scene variations that preserve ALL details from: ${cleanPrompt}` },
      ],
      temperature: 0.5, // Lower temperature for more consistency
      max_tokens: 500, // More tokens to allow for detailed scenes
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);

  if (Array.isArray(parsed.acts) && parsed.acts.length === 3) {
    console.log("📝 Base (Scene 2):", parsed.acts[1]);
    console.log("🎬 Scene variations (ALL DETAILS PRESERVED):");
    console.log("  Scene 1:", parsed.acts[0]);
    console.log("  Scene 2:", parsed.acts[1]);
    console.log("  Scene 3:", parsed.acts[2]);
    
    return {
      basePrompt: parsed.acts[1],
      acts: [parsed.acts[0], parsed.acts[1], parsed.acts[2]],
    };
  }

  throw new Error('Invalid format from OpenAI');
}

/**
 * Fallback: Create simple natural variations
 */
function createSimpleVariations(cleanPrompt: string): ScenePlan {
  // Detect if prompt has action words to create better variations
  const hasAction = /\b(walking|running|riding|flying|dancing|kissing|exploring|discovering)\b/i.test(cleanPrompt);
  
  let scene1: string;
  let scene2: string;
  let scene3: string;
  
  if (hasAction) {
    // Action-based variations
    scene1 = `${cleanPrompt}, beginning`;
    scene2 = `${cleanPrompt}, main action`;
    scene3 = `${cleanPrompt}, conclusion`;
  } else {
    // State-based variations (for prompts like "person in Agartha with creatures")
    scene1 = `${cleanPrompt}, establishing shot`;
    scene2 = `${cleanPrompt}, medium view`;
    scene3 = `${cleanPrompt}, close detail`;
  }
  
  console.log("📝 Base (Scene 2):", scene2);
  console.log("🎬 Scene variations (fallback):");
  console.log("  Scene 1:", scene1);
  console.log("  Scene 2:", scene2);
  console.log("  Scene 3:", scene3);
  
  return {
    basePrompt: scene2,
    acts: [scene1, scene2, scene3],
  };
}

/**
 * 🗑️ OLD "WINNING PATTERN" - REMOVED!
 *
 * This was adding:
 * - "photorealistic video footage of"
 * - "golden hour lighting"
 * - "NOT animated, NOT cartoon, NOT illustration"
 * - "realistic human skin textures, real-world physics"
 *
 * Problem: This KILLED variation and made videos repetitive!
 * Solution: Let the models work naturally with simple prompts!
 */

/**
 * 🌀 NEW: CINEMATIC ENHANCEMENT for Dreamcore Text-to-Video (10s + 5s)
 *
 * Purpose: Create 100x more detailed, cinematic prompts for Kling text-to-video
 *
 * NEW STRUCTURE:
 * - Clip 1 (10s): Progressive action with evolving camera movement
 * - Clip 2 (5s): Dramatic ending/climax
 *
 * Key Differences from getScenePlan():
 * - Uses GPT-4o (not mini) for maximum quality
 * - Creates 2 prompts instead of 3 (10s + 5s = 15s total)
 * - Clip 1: 50-100 words (describes beginning → middle progression)
 * - Clip 2: 30-50 words (describes dramatic ending)
 * - Adds extensive cinematic details:
 *   - Camera movements (tracking shot, crane, dolly, etc.)
 *   - Lighting (golden hour, volumetric, rim light, etc.)
 *   - Cinematography (depth of field, bokeh, film grain, etc.)
 *   - Motion details (slow motion, speed ramping, etc.)
 *   - Visual effects (lens flare, light streaks, etc.)
 *   - Atmosphere (moody, dramatic, epic, etc.)
 *
 * Why: Text-to-video benefits from detailed prompts, while Nano Banana needs simple prompts
 *
 * INPUT: Clean prompt (e.g., "POV floating through clouds")
 * OUTPUT: 2 cinematic prompts (10s main action + 5s ending)
 */
export async function enhanceDreamcorePrompt(cleanPrompt: string): Promise<DreamcorePlan> {
  console.log("🌀 Creating 2-CLIP CINEMATIC plan for dreamcore (10s + 5s)");
  console.log("📥 Input clean prompt:", cleanPrompt);

  const openaiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

  if (!openaiKey) {
    throw new Error("OpenAI API key required for cinematic enhancement");
  }

  try {
    const cinematicPlan = await createCinematic2ClipPlan(cleanPrompt, openaiKey);
    console.log("✅ Created 2-clip cinematic plan with GPT-4o");
    return cinematicPlan;
  } catch (error) {
    console.error("❌ Cinematic enhancement failed:", error);
    // Fallback to simple 2-clip plan if GPT-4o fails
    console.warn("⚠️ Falling back to simple 2-clip plan");
    return createSimple2ClipPlan(cleanPrompt);
  }
}

/**
 * Use GPT-4o to create 2-clip cinematic plan (10s + 5s)
 */
async function createCinematic2ClipPlan(cleanPrompt: string, openaiKey: string): Promise<DreamcorePlan> {
  const system = `You are a world-class cinematographer and director. Create 2 HIGHLY DETAILED, CINEMATIC prompts for professional text-to-video generation.

⏱️ STRUCTURE:
- CLIP 1: 10 seconds (progressive action: beginning → middle)
- CLIP 2: 5 seconds (dramatic ending/climax)

🎬 CINEMATIC ENHANCEMENT RULES:

1. PRESERVE ALL CORE DETAILS from input
   - If input says "POV" → ALL scenes must be first-person POV
   - If input says "floating" → ALL scenes must show floating
   - If input says "clouds" → ALL scenes must include clouds
   - NEVER change the core action or setting!

2. ADD MASSIVE CINEMATIC DETAIL:

   CLIP 1 (10 seconds - 50-100 words):
   - Describe PROGRESSIVE ACTION (beginning → middle)
   - Camera movement that EVOLVES over time
   - Lighting that CHANGES
   - Include: "starting from X, then moving to Y, progressing into Z"
   - Examples: "beginning low near water surface, then ascending higher through mist, progressing into open sky"

   CLIP 2 (5 seconds - 30-50 words):
   - Describe DRAMATIC ENDING/CLIMAX
   - Final moment or reveal
   - Peak intensity
   - Conclusion of the journey

   A. CAMERA WORK (CRITICAL):
      - POV type: "first-person POV", "camera mounted on", "handheld", "gimbal"
      - Movement: "tracking shot", "crane shot", "dolly zoom", "orbiting", "ascending"
      - Speed: "slow motion", "speed ramping", "rapid pan", "smooth glide"

   B. LIGHTING:
      - Time: "golden hour", "blue hour", "midday sun", "twilight", "night"
      - Quality: "volumetric lighting", "rim light", "backlighting", "god rays"
      - Style: "dramatic shadows", "soft diffused", "hard light", "neon glow"

   C. CINEMATOGRAPHY:
      - Focus: "depth of field", "shallow focus", "bokeh", "rack focus"
      - Effects: "lens flare", "light streaks", "film grain", "chromatic aberration"
      - Quality: "professional cinematography", "IMAX quality", "anamorphic lens"

   D. MOTION & DYNAMICS:
      - Action: "forward momentum", "vertical ascent", "banking turn", "drift"
      - Physics: "realistic motion blur", "natural inertia", "fluid movement"
      - Energy: "high-speed chase", "peaceful glide", "aggressive maneuvers"

   E. VISUAL DETAILS:
      - Colors: specific color palettes, gradients, contrasts
      - Textures: materials, surfaces, atmospheric effects
      - Atmosphere: "misty", "crystal clear", "hazy", "rain-soaked"

   F. MOOD & STYLE:
      - Emotion: "epic", "intimate", "mysterious", "exhilarating", "serene"
      - Genre: "cyberpunk", "sci-fi", "fantasy", "thriller", "adventure"
      - Aesthetic: "cinematic", "dramatic", "ethereal", "gritty", "dreamlike"

3. PROFESSIONAL LANGUAGE:
   - Write like a film director's shot description
   - Use industry-standard cinematography terms
   - Focus on what the CAMERA sees and how it moves

Return JSON: {"act1": "10s clip prompt", "act2": "5s clip prompt"}

✅ EXCELLENT EXAMPLES:

Input: "POV floating through clouds"
Output:
{
  "act1": "first-person POV beginning gentle ascent through soft white cumulus clouds at low altitude, golden hour sunlight breaking through gaps creating volumetric god rays, smooth upward camera movement with gradual acceleration building momentum, starting close to cloud surfaces then pulling back for wider perspective, dreamy ethereal atmosphere evolving from intimate to expansive, shallow depth of field with clouds drifting past frame, cinematic aerial photography, warm color palette transitioning from orange to pink to deeper gold, professional gimbal stabilization, film grain texture, wide angle lens capturing progressive revelation of vast sky above",

  "act2": "first-person POV emerging triumphantly above cloud layer in slow motion, revealing endless sea of clouds below stretching to horizon, sunset colors reflecting off cloud tops creating golden and pink reflections, dramatic crane shot rising up for epic reveal, breathtaking vista with inspirational mood, IMAX quality capture"
}

Input: "driving through neon city at night"
Output:
{
  "act1": "first-person POV from driver's seat entering neon-lit cyberpunk city at night, windshield reflecting pink and blue neon signs, camera mounted on dashboard capturing forward view, rain-soaked streets with puddles reflecting colorful lights, smooth tracking shot building speed as moving through sparse traffic into denser areas, high contrast lighting evolving from deep shadows to intense neon saturation, cinematic urban night photography, wet pavement creating dynamic mirror reflections, progressive acceleration from calm cruise to high-speed chase intensity, bokeh effect on background lights growing more pronounced, film noir aesthetic transitioning to aggressive cyberpunk energy",

  "act2": "first-person POV drifting around final corner at maximum speed, banking turn with dramatic camera tilt, spray of water catching neon reflections in slow motion cinematic payoff, volumetric fog from vehicle exhaust, rim lighting from neon signs, epic arrival moment with moody thriller aesthetic"
}

❌ BAD EXAMPLE (Too Simple):
{
  "act1": "person floating in clouds",
  "act2": "person still floating"
}
Why bad: No cinematic detail, no camera work, no lighting, no progression, too short!

🎯 REMEMBER:
- Act 1 must be 50-100 words with PROGRESSIVE action
- Act 2 must be 30-50 words with dramatic ENDING
- Include specific camera movements, lighting, and cinematography terms
- Preserve the core action from input
- Write like a professional cinematographer`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o', // 🔥 Use GPT-4o for maximum quality
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Create 2 highly detailed cinematic prompts (act1: 10s with 50-100 words, act2: 5s with 30-50 words). Preserve core details from: ${cleanPrompt}` },
      ],
      temperature: 0.7, // Higher creativity for cinematic descriptions
      max_tokens: 1500, // Enough tokens for 2 detailed prompts
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI GPT-4o failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);

  if (parsed.act1 && parsed.act2) {
    console.log("🎬 2-CLIP CINEMATIC plan created:");
    console.log("  ⏱️ Act 1 (10s) length:", parsed.act1.split(' ').length, "words");
    console.log("  ⏱️ Act 2 (5s) length:", parsed.act2.split(' ').length, "words");
    console.log("\n📝 Act 1 (10s MAIN ACTION):", parsed.act1);
    console.log("\n📝 Act 2 (5s ENDING):", parsed.act2);

    return {
      act1: parsed.act1,
      act2: parsed.act2,
      basePrompt: parsed.act1, // Use act1 as base
    };
  }

  throw new Error('Invalid format from OpenAI GPT-4o - expected act1 and act2');
}

/**
 * Fallback: Create simple 2-clip plan if GPT-4o fails
 */
function createSimple2ClipPlan(cleanPrompt: string): DreamcorePlan {
  console.log("⚠️ Creating simple 2-clip fallback plan");

  const act1 = `${cleanPrompt}, beginning and progressing through main action`;
  const act2 = `${cleanPrompt}, dramatic ending`;

  return {
    act1,
    act2,
    basePrompt: act1,
  };
}

export default {};