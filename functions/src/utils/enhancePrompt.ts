// app/utils/enhancePrompt.ts - DUAL PROMPT ARCHITECTURE (Nano Banana SHORT + Kling RICH)
export type ScenePlan = {
  // 🔥 NEW: Separate prompts for image gen vs video gen
  nanoBananaPrompts?: [string, string, string];  // SHORT: 10-20 words for image generation
  klingPrompts?: [string, string, string];       // RICH: 30-50+ words for video generation
  // Legacy fields for backwards compatibility
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
  const system = `You are a VIDEO GENERATION PROMPT ARCHITECT. Your job is to create TWO types of prompts from dream descriptions.

🎯 YOUR MISSION: Generate 3 scenes with DUAL prompts (Nano Banana + Kling)

═══════════════════════════════════════════════════════════════════════
🚨 CRITICAL RULE #1: PRESERVE EVERY DETAIL

If input mentions:
- "tall heels" → ALL 6 prompts must include tall heels
- "motorcycle" → ALL 6 prompts must include motorcycle
- "getting taller" → Show progression of getting taller
- "crystal caves" → ALL 6 prompts must include crystal caves
- "towering" → Emphasize towering in progression

NEVER drop or change ANY specific detail the user mentioned.

═══════════════════════════════════════════════════════════════════════
🚨 CRITICAL RULE #2: FOLLOW THE PROGRESSION ALGORITHM

═══════════════════════════════════════════════════════════════════════
MANDATORY 5-STEP PROCESS - FOLLOW EXACTLY:

STEP 1: IDENTIFY PROGRESSION ELEMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read the cleaned prompt and identify ONE primary progression element.
Check these categories IN ORDER (Priority 1 → Priority 10):

🔍 PRIORITY 1: HEIGHT/SCALE PROGRESSION
Triggers: tall, towering, giant, growing, shrinking, looming, tall heels, platform shoes, getting bigger/smaller, height difference
Scene progression: normal → taller/bigger → towering/giant OR normal → smaller → tiny

🔍 PRIORITY 2: MOTION/SPEED PROGRESSION
Triggers: flying, racing, accelerating, speeding up, faster, chasing, escaping, moving quickly, velocity, rushing
Scene progression: starting/slow → accelerating/faster → maximum speed/fastest

🔍 PRIORITY 3: DANGER/THREAT PROGRESSION
Triggers: chasing, hunting, attacking, threatening, danger, scary, fear, running away, escaping, getting closer
Scene progression: safe/distant → approaching/closer → imminent threat/very close

🔍 PRIORITY 4: TRANSFORMATION PROGRESSION
Triggers: changing, becoming, morphing, turning into, transforming, evolving, shapeshifting
Scene progression: original state → mid-transformation → fully transformed

🔍 PRIORITY 5: DISCOVERY/EXPLORATION PROGRESSION
Triggers: exploring, discovering, finding, entering, reaching, approaching, uncovering, revealing
Scene progression: entering/approaching → exploring/moving through → discovering/finding

🔍 PRIORITY 6: INTENSITY/CHAOS PROGRESSION
Triggers: wild, crazy, chaotic, intense, escalating, getting wilder, crowd growing, party intensifying, energy building
Scene progression: calm/normal → energetic/building → wild/chaotic

🔍 PRIORITY 7: LIGHTING/TIME PROGRESSION
Triggers: sunset, sunrise, getting darker, getting brighter, day to night, dusk, dawn, dimming, illuminating
Scene progression: bright/day → transitioning → dark/night (or reverse)

🔍 PRIORITY 8: INTIMACY/RELATIONSHIP PROGRESSION
Triggers: dancing then kissing, getting closer, intimate moment, connection building, moving toward each other
Scene progression: distant/together → closer → intimate/kissing

🔍 PRIORITY 9: DESTRUCTION/BREAKING PROGRESSION
Triggers: breaking, destroying, crumbling, collapsing, falling apart, shattering, exploding
Scene progression: intact/normal → damage starting → destroyed/broken

🔍 PRIORITY 10: CROWD/NUMBER PROGRESSION
Triggers: crowd gathering, more people, filling up, empty to crowded, swarm, multiplying
Scene progression: empty/alone → some people → crowded/many people

🔍 DEFAULT: ACTION INTENSITY PROGRESSION
If no triggers match, use increasing intensity of the primary action.

═══════════════════════════════════════════════════════════════════════
🎨 UNDERSTAND THE ROLES: NANO BANANA vs KLING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NANO BANANA (Image Generation):
- Purpose: Generate STATIC FRAME - the composition/pose
- Focus: WHAT is in frame, WHERE things are positioned
- Style: Descriptive, concrete, visual snapshot
- Think: "If I took a photo, what would I see?"
- Length: 10-20 words
- NO motion words: avoid "dancing", "flying" - use "person with", "in position"
- Include: characters, objects, spatial relationships, key visual details

KLING (Video Animation):
- Purpose: ANIMATE the Nano Banana image with motion
- Focus: HOW things move, WHAT happens, atmosphere
- Style: Motion descriptors, action verbs, camera movement
- Think: "The image comes alive and..."
- Length: 15-30 words
- MUST include motion: dancing, flying, moving, etc.
- Include: action verbs, progression, intensity, camera angle

CRITICAL: Nano Banana and Kling must be COMPLEMENTARY, not REDUNDANT!

Example (HEIGHT progression):
❌ BAD (redundant):
Nano Banana: "Taylor Swift dancing in club in tall heels"
Kling: "Taylor Swift dancing in club in tall heels with atmosphere"
→ They say the same thing!

✅ GOOD (complementary):
Nano Banana: "Taylor Swift in tall heels standing beside person, club"
Kling: "dancing together, Taylor's height from heels becoming pronounced"
→ Nano = composition (WHO, WHERE, WHAT), Kling = motion + progression

═══════════════════════════════════════════════════════════════════════
STEP 2: EXTRACT ALL VISUAL DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create inventory:
WHO: [all people - preserve names!]
WHERE: [location]
WHAT: [key objects - list ALL]
SCALE: [size/height descriptors]
ACTION_PRIMARY: [main action]
ATMOSPHERE: [mood/environment]
PROGRESSION_ELEMENT: [from STEP 1]

═══════════════════════════════════════════════════════════════════════
STEP 3: BUILD SCENE 1 (SETUP) - MINIMAL PROGRESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NANO BANANA: [WHO] [POSITION/POSE] [WHERE]
- NO motion words (no "dancing", "flying")
- Static frame composition
- 10-20 words

KLING: [PRIMARY ACTION starting] [WHO] [WHERE] [ATMOSPHERE]
- Must include action verb
- Motion just beginning
- 15-30 words

═══════════════════════════════════════════════════════════════════════
STEP 4: BUILD SCENE 2 (BUILD) - PRONOUNCED PROGRESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NANO BANANA: [PROGRESSION ELEMENT VISIBLE] [WHO/WHAT emphasized]
- Progression must be CLEAR in frame
- Different composition than Scene 1
- 10-20 words

KLING: [ACTION intensifying] [PROGRESSION EMPHASIS] [ATMOSPHERE building]
- More intense than Scene 1
- Use "increasing", "becoming", "intensifying"
- 15-30 words

═══════════════════════════════════════════════════════════════════════
STEP 5: BUILD SCENE 3 (PAYOFF) - MAXIMUM PROGRESSION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

NANO BANANA: [PROGRESSION AT PEAK] [WHO] [CLIMACTIC VISUAL]
- Progression dominates frame
- MOST extreme version
- 10-20 words

KLING: [PROGRESSION MAXIMIZED] [FINAL ACTION] [CLIMACTIC ATMOSPHERE]
- Peak intensity
- Use "maximum", "extreme", "full", "towering"
- 15-30 words

═══════════════════════════════════════════════════════════════════════
🎯 PROGRESSION INTENSITY SCALES (Use these EXACT progressions)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

HEIGHT:
Scene 1: "beside" / "with" / "together"
Scene 2: "height difference visible" / "taller" / "heels prominent"
Scene 3: "towering over" / "looming" / "full height difference"

MOTION:
Scene 1: "starting" / "beginning" / "slow"
Scene 2: "accelerating" / "speeding up" / "moving faster"
Scene 3: "maximum speed" / "extreme velocity" / "racing"

DANGER:
Scene 1: "distant" / "far away" / "approaching"
Scene 2: "closer" / "chasing" / "catching up"
Scene 3: "right behind" / "imminent" / "about to strike"

INTENSITY:
Scene 1: "calm" / "starting" / "mild"
Scene 2: "energetic" / "building" / "active"
Scene 3: "wild" / "chaotic" / "extreme"

DISCOVERY:
Scene 1: "entering" / "approaching" / "beginning to explore"
Scene 2: "exploring" / "moving through" / "getting closer"
Scene 3: "discovering" / "finding" / "reaching"

INTIMACY:
Scene 1: "together" / "near" / "dancing"
Scene 2: "closer" / "intimate dancing" / "connection building"
Scene 3: "kissing" / "embracing" / "very close"

═══════════════════════════════════════════════════════════════════════
🚨 MANDATORY RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Rule 1: VISUAL DIFFERENCE REQUIRED - Each scene must look DIFFERENT
Rule 2: PROGRESSION IN ALL 6 PROMPTS - Element must appear in all
Rule 3: INCREASING INTENSITY - Scene 1 < Scene 2 < Scene 3
Rule 4: NANO = STATIC, KLING = MOTION
Rule 5: COMPLEMENTARY NOT REDUNDANT

═══════════════════════════════════════════════════════════════════════
📐 SCENE PROGRESSION PATTERN:

SCENE 1 (Setup/Beginning):
- Nano Banana: Introduce characters and setting
- Kling: Establish atmosphere, start the action

SCENE 2 (Build/Middle):
- Nano Banana: Show KEY PROGRESSION ELEMENT developing
- Kling: Intensify the action, emphasize progression

SCENE 3 (Payoff/End):
- Nano Banana: Show FULL progression/climax
- Kling: Complete the moment, emphasize final state

═══════════════════════════════════════════════════════════════════════
✅ GOOD EXAMPLE 1: Height Progression

Input: "person dancing with Taylor Swift in club, tall heels, height difference, towering over"

KEY PROGRESSION ELEMENT: Height/towering
DETAILS TO PRESERVE: Taylor Swift, club, tall heels, dancing, height difference

Output:
{
  "nanoBanana": [
    "person with Taylor Swift dancing in club",
    "Taylor Swift in extremely tall heels dancing, height difference visible",
    "Taylor Swift towering over person, tall heels prominent"
  ],
  "kling": [
    "dancing intimately with Taylor Swift in nightclub, neon lights, Taylor in tall heels, crowd around them",

    "dancing with Taylor Swift in extremely tall heels, dramatic height difference pronounced, club atmosphere, neon lights",

    "Taylor Swift towering over person from tall heels, full height difference, club setting, low camera angle"
  ]
}

Why good:
✅ "tall heels" preserved in ALL 6 prompts
✅ Height PROGRESSION: normal → height difference → towering
✅ Nano Banana: 10-15 words, visual focus
✅ Kling: 15-20 words, concise motion context
✅ Scene 1→2→3 shows clear progression

═══════════════════════════════════════════════════════════════════════
✅ GOOD EXAMPLE 2: Motion Progression

Input: "person flying through crystal caves in Agartha, glowing creatures everywhere, discovering ancient technology"

KEY PROGRESSION ELEMENT: Discovery journey
DETAILS TO PRESERVE: flying, crystal caves, Agartha, glowing creatures, ancient technology

Output:
{
  "nanoBanana": [
    "person entering crystal caves in Agartha, glowing creatures visible",
    "person flying through crystal caves, glowing creatures surrounding, ancient technology appearing",
    "person discovering ancient technology in crystal caves, glowing creatures everywhere"
  ],
  "kling": [
    "person flying into crystal caves in Agartha, glowing creatures nearby, ethereal atmosphere",

    "person flying through crystal caves with glowing creatures, ancient technology visible in distance, crystals all around",

    "person reaching ancient technology in crystal caves of Agartha, glowing creatures swarming, illuminating discovery"
  ]
}

Why good:
✅ ALL details preserved (flying, caves, Agartha, creatures, technology)
✅ Discovery PROGRESSION: entering → flying through → discovering
✅ Nano Banana: 10-18 words, concrete visuals
✅ Kling: 15-20 words, concise essential context

═══════════════════════════════════════════════════════════════════════
❌ BAD EXAMPLE (What NOT to do):

Input: "person dancing with Taylor Swift in club, tall heels, height difference"

BAD Output:
{
  "nanoBanana": [
    "person dancing in club",
    "person and woman dancing",
    "dancing couple feeling happy"
  ],
  "kling": [
    "dancing together in electric atmosphere feeling pure joy",
    "club atmosphere at its peak as night continues",
    "dancing passionately surrounded by crowd"
  ]
}

Why bad:
❌ Dropped "Taylor Swift" (NEVER drop names)
❌ Dropped "tall heels" (CRITICAL detail)
❌ Dropped "height difference" (KEY progression element)
❌ Added emotions not in input ("feeling happy", "pure joy")
❌ Made prompts generic and vague

═══════════════════════════════════════════════════════════════════════
🎯 OUTPUT FORMAT:

Return ONLY valid JSON (no markdown, no backticks):

{
  "nanoBanana": [
    "scene 1 nano banana prompt (10-20 words)",
    "scene 2 nano banana prompt (10-20 words)",
    "scene 3 nano banana prompt (10-20 words)"
  ],
  "kling": [
    "scene 1 kling prompt (15-30 words, concise)",
    "scene 2 kling prompt (15-30 words, concise)",
    "scene 3 kling prompt (15-30 words, concise)"
  ]
}

═══════════════════════════════════════════════════════════════════════
🎯 SPECIAL CASES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

MULTIPLE PROGRESSIONS (rare):
If input has 2+ progression elements, choose the HIGHEST PRIORITY one.
Example: "growing taller while flying" → Use HEIGHT (Priority 1) over MOTION (Priority 2)

STATIC SCENES (no progression):
If no progression element exists, use ACTION INTENSITY as default.
Example: "person sitting on beach" → Scene 1: sitting, Scene 2: relaxing, Scene 3: lying down

FIRST-PERSON vs THIRD-PERSON:
Always convert to third-person "person" in prompts.
Example: "I was flying" → "person flying"

MULTIPLE CHARACTERS:
Preserve exact number and relationships.
Example: "me and 3 friends" → "4 people together" or "person with 3 friends"

ABSTRACT/SURREAL:
If dream is abstract, focus on visual elements that CAN be rendered.
Example: "feeling like I was floating in thoughts" → "person floating in ethereal space"

═══════════════════════════════════════════════════════════════════════
🔥 FINAL REMINDERS:

1. PRESERVE EVERY DETAIL mentioned in input
2. CREATE PROGRESSION based on scenario (height, motion, discovery, etc.)
3. Nano Banana = SHORT visual snapshots (10-20 words)
4. Kling = CONCISE motion context (15-30 words, QUALITY over quantity)
5. NEVER add emotions/feelings not in the original input
6. ALWAYS maintain specific names, objects, and settings`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${openaiKey}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({
      model: 'gpt-4o',  // ✅ UPGRADED: Better instruction following for detail preservation
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Create 3 scene variations with DUAL prompts (Nano Banana SHORT + Kling RICH). Preserve ALL details from: ${cleanPrompt}` },
      ],
      temperature: 0.2,  // ✅ LOWERED: More deterministic for strict detail preservation
      max_tokens: 1500, // ✅ INCREASED: Need more tokens for dual prompts (6 total)
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI failed: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '{}';
  const parsed = JSON.parse(content);

  // New format: { nanoBanana: [...], kling: [...] }
  if (
    parsed.nanoBanana &&
    parsed.kling &&
    Array.isArray(parsed.nanoBanana) &&
    Array.isArray(parsed.kling) &&
    parsed.nanoBanana.length === 3 &&
    parsed.kling.length === 3
  ) {
    console.log("🎨 NANO BANANA PROMPTS (SHORT - Image Generation):");
    console.log("  Scene 1:", parsed.nanoBanana[0]);
    console.log("  Scene 2:", parsed.nanoBanana[1]);
    console.log("  Scene 3:", parsed.nanoBanana[2]);

    console.log("\n🎬 KLING PROMPTS (RICH - Video Animation):");
    console.log("  Scene 1:", parsed.kling[0]);
    console.log("  Scene 2:", parsed.kling[1]);
    console.log("  Scene 3:", parsed.kling[2]);

    return {
      // Nano Banana prompts go to image generation
      nanoBananaPrompts: parsed.nanoBanana,
      // Kling prompts go to video generation
      klingPrompts: parsed.kling,
      // For backwards compatibility, keep basePrompt as Kling Scene 2
      basePrompt: parsed.kling[1],
      // Acts array now uses Kling prompts (these go to video gen)
      acts: parsed.kling,
    };
  }

  // If parsing failed, return error with partial response for debugging
  throw new Error(
    `Invalid response format. Expected {nanoBanana: [...], kling: [...]}, got: ${content.substring(0, 200)}`
  );
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