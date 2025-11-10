// app/utils/smartPromptProcessor.ts - HYBRID: Smart extraction + Simple output
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
});

export interface ProcessedPrompt {
  cleanPrompt: string;
  isBlocked: boolean;
  blockReason?: string;
  originalPrompt: string;
  processingTime: number;
  detectedLanguage?: string;
}

/**
 * 🎯 HYBRID APPROACH:
 * - Extract user intent intelligently (people, actions, locations, emotions)
 * - Remove explicit content
 * - Output SIMPLE, NATURAL language (no rigid templates!)
 * - Let the video models do their magic naturally
 */
export async function processPromptForGeneration(userPrompt: string): Promise<ProcessedPrompt> {
  const startTime = Date.now();
  
  console.log('🧠 Processing prompt:', userPrompt);
  
  // Fast path: If no OpenAI key, do basic cleaning
  if (!process.env.EXPO_PUBLIC_OPENAI_API_KEY) {
    console.warn('⚠️ No OpenAI key, using basic cleaning');
    return {
      cleanPrompt: basicPromptCleaning(userPrompt),
      isBlocked: false,
      originalPrompt: userPrompt,
      processingTime: Date.now() - startTime,
    };
  }

  try {
    // Use GPT-4o for intelligent hybrid cleaning
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert at processing dream descriptions for AI video generation. You work with ALL languages.

🎯 YOUR MISSION: Extract clean content, MATCH input complexity naturally

🌍 MULTI-LANGUAGE SUPPORT:
- User may input in ANY language (English, Greek, Spanish, French, Arabic, Chinese, etc.)
- Detect and remove inappropriate content in ANY language
- After cleaning, translate result to English for AI models

CRITICAL RULES:

1. EXTRACT CLEAN STRUCTURE:
   ✅ KEEP: People, locations, actions, emotions, objects, time of day, creative elements
   ❌ REMOVE: Explicit sexual content, celebrity names, pornography
   
2. WHAT TO REMOVE:
   - Explicit sexual acts: fucking, sex, intercourse, oral, anal, masturbation, penetration
   - Nudity: naked, nude, exposed genitals, topless, dick out, tits out
   - Pornography: porn, xxx, adult content
   - Multi-language equivalents (γαμάω, coger, baiser, etc.)
   - Celebrity names → replace with "person", "man", "woman"

3. WHAT TO KEEP:
   - People: man, woman, friend, person, girlfriend, boyfriend, multiple characters
   - Locations: park, beach, home, city, forest, room, street, Agartha, crystal caves, ancient ruins
   - Actions: walking, running, riding, dancing, sitting, kissing, hugging, flying, exploring, discovering
   - Objects: motorcycle, car, house, tree, dog, cat, crystals, technology, glowing creatures
   - Emotions: happy, sad, love, excited, peaceful, weird, mysterious, scared
   - Time: sunset, sunrise, night, morning, afternoon
   - Creative elements: glowing, ancient, futuristic, magical, strange
   - Adjectives: beautiful, hot, gorgeous, handsome, cute, weird, scary, peaceful

4. OUTPUT FORMAT - MATCH INPUT COMPLEXITY:
   
   🔸 SIMPLE INPUT (1-2 elements) → SIMPLE OUTPUT (8-15 words):
   - "kissing girlfriend in park" → "person kissing woman in park"
   - "riding motorcycle" → "person riding motorcycle"
   
   🔸 COMPLEX INPUT (3+ elements) → PRESERVE DETAILS (15-25 words):
   - "flying through Agartha crystal caves with glowing creatures" → "person flying through crystal caves in Agartha with glowing creatures"
   - "exploring ancient ruins, finding mysterious technology, weird atmosphere" → "person exploring ancient ruins and finding mysterious technology in weird atmosphere"
   
   🔸 GOLDEN RULE: MATCH the complexity, NEVER ADD things that weren't in the original!
   
   ❌ NO technical terms like "photorealistic", "cinematic", "high quality"
   ❌ NO instructions like "NOT animated", "NOT cartoon"
   ❌ NO camera angles or lighting terms
   ✅ Just describe WHAT is happening naturally
   
   - If fully explicit: Return "BLOCKED: Fully explicit content"

EXAMPLES - SEE THE PATTERN:

✅ SIMPLE PROMPTS (Keep Simple):

Input: "I saw that I kissed Lucie tabitha in a park"
Output: "person kissing woman in park"
Why: 1-2 elements, simple output

Input: "I was riding a motorcycle with my girlfriend"
Output: "person riding motorcycle with woman"
Why: 1 main action, simple output

Input: "Walking on the beach at sunset"
Output: "person walking on beach at sunset"
Why: 1 action + time, simple output

Input: "My friend and I were playing with my dog"
Output: "two people playing with dog"
Why: 1 main action, simple output

✅ COMPLEX PROMPTS (Preserve Details):

Input: "I was in Agartha and it was Johnny Sins showing me crystal caves with glowing creatures"
Output: "person exploring crystal caves in Agartha with glowing creatures"
Why: Multiple elements (location, setting, objects), preserved all clean content, removed celebrity

Input: "Flying over my childhood home with my best friend on a sunny afternoon feeling nostalgic"
Output: "person flying over childhood home with friend on sunny afternoon feeling nostalgic"
Why: Multiple elements (action, location, companion, time, emotion), kept all

Input: "I was riding a motorcycle through neon-lit city streets at night with rain falling and weird futuristic buildings"
Output: "person riding motorcycle through neon-lit city at night with rain and futuristic buildings"
Why: Multiple elements (action, setting, time, atmosphere, objects), preserved details

Input: "Dancing with Taylor Swift at a party under colorful lights feeling amazing and the music was incredible"
Output: "person dancing with woman at party under colorful lights feeling amazing"
Why: Multiple elements, removed celebrity, kept atmosphere + emotion

Input (Greek + Complex): "Είδα ότι πετούσα πάνω από κρυστάλλινες σπηλιές με φωτεινά πλάσματα στην Αγάρθα"
Translation: "I saw that I was flying over crystal caves with glowing creatures in Agartha"
Output: "person flying over crystal caves in Agartha with glowing creatures"
Why: Multiple elements, translated and preserved all details

❌ BAD OUTPUTS:

Input: "kissing girlfriend in park"
Bad Output: "person kissing woman in park with beautiful scenery and romantic atmosphere"
Why: ADDED things! User didn't mention scenery or romantic. DON'T ADD!

Input: "flying in Agartha"
Bad Output: "photorealistic video of person flying in Agartha with cinematic lighting"
Why: ADDED technical terms! Keep it natural!

🎯 DECISION TREE:
1. Count meaningful elements (actions, locations, objects, emotions)
2. Remove explicit terms and celebrities
3. If 1-2 elements → Simple output (8-15 words)
4. If 3+ elements → Preserve details (15-25 words)
5. NEVER add things that weren't in the input
6. Keep it NATURAL - no technical jargon
7. If nothing clean left → Return "BLOCKED: Fully explicit content"

Return ONLY the natural prompt (matching input complexity) or "BLOCKED: Fully explicit content"`
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_tokens: 150,
      temperature: 0.3,
    });
    
    let result = response.choices[0].message.content?.trim() || userPrompt;
    
    // Strip quotes that GPT sometimes adds
    result = result.replace(/^["'`]+|["'`]+$/g, '');
    result = result.replace(/^"(.+)"$/s, '$1');
    
    console.log('📝 Smart processor output:', result);
    
    // Check if blocked
    if (result.startsWith('BLOCKED:')) {
      const blockReason = result.replace('BLOCKED:', '').trim();
      console.log('🚫 Prompt blocked:', blockReason);
      
      return {
        cleanPrompt: '',
        isBlocked: true,
        blockReason,
        originalPrompt: userPrompt,
        processingTime: Date.now() - startTime,
      };
    }
    
    // Success - we have a simple, natural prompt
    console.log('✅ Clean natural prompt:', result);
    console.log(`⏱️ Processing time: ${Date.now() - startTime}ms`);
    
    return {
      cleanPrompt: result,
      isBlocked: false,
      originalPrompt: userPrompt,
      processingTime: Date.now() - startTime,
    };
    
  } catch (error) {
    console.error('❌ Smart processing failed:', error);
    console.log('⚠️ Falling back to basic cleaning');
    
    return {
      cleanPrompt: basicPromptCleaning(userPrompt),
      isBlocked: false,
      originalPrompt: userPrompt,
      processingTime: Date.now() - startTime,
    };
  }
}

/**
 * Basic prompt cleaning (fallback when OpenAI unavailable)
 */
function basicPromptCleaning(prompt: string): string {
  let cleaned = prompt.toLowerCase();
  
  // Remove explicit terms (English only)
  const explicitTerms = [
    'fuck', 'fucking', 'dick', 'cock', 'pussy', 'sex', 'naked', 'nude',
    'porn', 'xxx', 'nsfw', 'blowjob', 'handjob'
  ];
  
  for (const term of explicitTerms) {
    if (cleaned.includes(term)) {
      console.warn('⚠️ Explicit term detected in fallback mode:', term);
      cleaned = cleaned.replace(new RegExp(term, 'gi'), '');
    }
  }
  
  // Remove celebrity names (basic)
  const celebNames = ['johnny sins', 'kim kardashian', 'elon musk', 'taylor swift'];
  for (const name of celebNames) {
    cleaned = cleaned.replace(new RegExp(name, 'gi'), 'person');
  }
  
  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned || prompt;
}

export default { processPromptForGeneration };