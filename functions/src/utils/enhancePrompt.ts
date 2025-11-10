// app/utils/enhancePrompt.ts - NATURAL VARIATIONS (No Rigid Templates!)
export type ScenePlan = {
  acts: [string, string, string];
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

export default {};