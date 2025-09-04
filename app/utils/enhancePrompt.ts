// app/utils/enhancePrompt.ts - 100X PROMPT ENHANCEMENT WITH OPENAI
const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('⚠️ Missing EXPO_PUBLIC_OPENAI_API_KEY - Prompt enhancement will use fallback');
}

// ===== MAIN ENHANCE FUNCTION =====
export async function enhancePrompt(
  rawText: string, 
  selectedImages: string[] = []
): Promise<string[]> {
  
  const hasFace = selectedImages.length > 0;
  
  // First, enhance the raw prompt 100x with OpenAI
  const enhancedPrompt = await enhance100x(rawText, hasFace);
  
  // Then split the enhanced prompt into 3 cinematic acts
  const acts = await splitInto3Acts(enhancedPrompt, hasFace);
  
  return acts;
}

// ===== 100X PROMPT ENHANCEMENT =====
async function enhance100x(
  rawText: string, 
  hasFace: boolean
): Promise<string> {
  
  if (!OPENAI_API_KEY) {
    console.log('⚠️ No OpenAI key, using basic enhancement');
    return `${rawText}. Cinematic, detailed, beautiful lighting, realistic, emotional`;
  }

  try {
    console.log('🚀 [ENHANCE] Making prompt 100x more detailed with OpenAI...');
    
    const systemPrompt = `You are a master cinematic prompt engineer. Transform the user's simple dream description into an incredibly detailed, vivid, and cinematic prompt that's 100x more detailed and realistic.

ENHANCEMENT RULES:
- Transform simple descriptions into vivid, sensory-rich scenes
- Add specific lighting details (golden hour, soft shadows, warm glow, etc.)
- Include camera angles and cinematography (wide shot, close-up, tracking shot)
- Describe textures, colors, and atmosphere in detail
- Add emotional depth and human expressions
- Include ambient sounds and environmental details
- Make it feel like a premium movie scene
- Keep the core meaning but amplify every aspect
- Focus on realistic, achievable video generation prompts
${hasFace ? '- Ensure face consistency and natural human expressions' : ''}

STYLE: Cinematic realism, emotional depth, premium quality, detailed visual storytelling

EXAMPLE:
Input: "Walking with my dog"
Output: "Walking slowly hand-in-hand with my beloved golden retriever through a sun-dappled forest path during golden hour, warm amber light filtering through ancient oak leaves casting dancing shadows on the moss-covered ground, feeling peaceful and content as birds chirp softly in the distance and a gentle breeze rustles the leaves, shot with a cinematic wide angle slowly tracking forward, natural film grain, soft focus background"

Transform the user's dream into this level of detailed, cinematic beauty:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Cost-effective model
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: rawText }
        ],
        max_tokens: 300,
        temperature: 0.7 // Good balance of creativity and consistency
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI enhancement error:', errorText);
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const result = await response.json();
    const enhancedPrompt = result.choices[0]?.message?.content?.trim();
    
    if (!enhancedPrompt) {
      throw new Error('No enhanced prompt from OpenAI');
    }
    
    console.log('✅ [ENHANCE] Prompt enhanced 100x!');
    console.log('Original:', rawText);
    console.log('Enhanced:', enhancedPrompt.slice(0, 100) + '...');
    
    return enhancedPrompt;

  } catch (error) {
    console.warn('⚠️ OpenAI enhancement failed, using fallback:', error);
    
    // Fallback enhancement if OpenAI fails
    return `${rawText}. Shot in cinematic style with beautiful golden hour lighting, soft focus background, warm colors, emotional depth, realistic details, premium film quality, natural expressions, atmospheric mood`;
  }
}

// ===== SPLIT INTO 3 CINEMATIC ACTS =====
async function splitInto3Acts(
  enhancedPrompt: string, 
  hasFace: boolean
): Promise<string[]> {
  
  if (!OPENAI_API_KEY) {
    console.log('⚠️ No OpenAI key, using manual split');
    return createFallbackSplit(enhancedPrompt);
  }

  try {
    console.log('🎬 [SPLIT] Creating 3-act cinematic structure...');
    
    const systemPrompt = `You are a cinematic storytelling expert. Split the enhanced dream prompt into exactly 3 different video clips that tell a complete story.

STRUCTURE:
- Act 1 (Establishing): Wide establishing shot introducing the scene, setting, and mood
- Act 2 (Development): Medium shot showing the main action, movement, or interaction  
- Act 3 (Resolution): Close-up shot capturing emotions, reactions, or conclusion

RULES:
- Each act must be COMPLETELY DIFFERENT but tell one flowing story
- Each clip should be 6 seconds of continuous action
- Include specific camera movements and angles
- Maintain visual consistency across all 3 acts
- Progress from wide → medium → close-up naturally
- Each act builds upon the previous one emotionally
- Add cinematic transitions and flow between acts
${hasFace ? '- Keep the same person/character appearance throughout' : ''}

IMPORTANT: Create 3 DISTINCT scenes, not 3 versions of the same scene!

Return JSON: {"act1": "establishing_shot_prompt", "act2": "development_shot_prompt", "act3": "resolution_shot_prompt"}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Split this enhanced dream into 3 cinematic acts: "${enhancedPrompt}"` }
        ],
        max_tokens: 600,
        temperature: 0.8
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI split error: ${response.status}`);
    }

    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content from OpenAI split');
    }
    
    const parsed = JSON.parse(content);
    const { act1, act2, act3 } = parsed;
    
    if (act1 && act2 && act3) {
      console.log('✅ [SPLIT] 3 cinematic acts created!');
      console.log('Act 1:', act1.slice(0, 60) + '...');
      console.log('Act 2:', act2.slice(0, 60) + '...');
      console.log('Act 3:', act3.slice(0, 60) + '...');
      
      return [act1, act2, act3];
    }
    
    throw new Error('Invalid acts format from OpenAI');

  } catch (error) {
    console.warn('⚠️ AI splitting failed, using fallback:', error);
    return createFallbackSplit(enhancedPrompt);
  }
}

// ===== FALLBACK SPLIT IF OPENAI FAILS =====
function createFallbackSplit(enhancedPrompt: string): string[] {
  const act1 = `${enhancedPrompt}. ESTABLISHING SHOT: Wide cinematic angle revealing the full scene and setting the emotional tone with beautiful atmospheric lighting.`;
  
  const act2 = `${enhancedPrompt}. DEVELOPMENT SHOT: Dynamic medium shot focusing on the main action and movement with smooth camera tracking and natural flow.`;
  
  const act3 = `${enhancedPrompt}. RESOLUTION SHOT: Intimate close-up capturing the emotional conclusion and facial expressions with dramatic depth of field and warm lighting.`;
  
  return [act1, act2, act3];
}

// ===== UTILITY FUNCTIONS =====

// Check if enhancement is available
export function canEnhancePrompts(): boolean {
  return !!OPENAI_API_KEY;
}

// Get enhancement status message
export function getEnhancementStatus(): string {
  return OPENAI_API_KEY 
    ? '✅ AI Enhancement Active' 
    : '⚠️ Using Basic Enhancement (Add OpenAI key for 100x enhancement)';
}