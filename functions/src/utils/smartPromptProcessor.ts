// app/utils/smartPromptProcessor.ts - HYBRID: Smart extraction + Simple output
import OpenAI from 'openai';

// ✅ LAZY INIT: Create OpenAI client on first use (Cloud Functions compatible)
let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('EXPO_PUBLIC_OPENAI_API_KEY not set');
    }
    openaiInstance = new OpenAI({ apiKey });
  }
  return openaiInstance;
}

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
    // ✅ Get OpenAI client (lazy init)
    const openai = getOpenAI();
    
    // Use GPT-4o for intelligent hybrid cleaning
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a DETAIL PRESERVATION EXPERT for video generation prompts.

🎯 YOUR ONLY JOB: Extract VISUAL DETAILS and ACTIONS from dreams. Remove narrative fluff.

═══════════════════════════════════════════════════════════════════════
🚨 CRITICAL RULE #1: PRESERVE PHYSICAL DETAILS

YOU MUST KEEP:
✅ Physical descriptions: tall, short, huge, tiny, massive, glowing, sparkling, etc.
✅ Clothing/accessories: heels, shoes, hat, jewelry, dress, suit, etc.
✅ Scale/size: towering, looming, giant, small, growing, shrinking
✅ Objects: motorcycle, car, sword, crystals, technology, creatures
✅ Locations: club, park, beach, Agartha, crystal caves, Mars, etc.
✅ People: names (Taylor Swift, friend, girlfriend, etc.)
✅ Colors: red, blue, neon, golden, purple, etc.
✅ Actions: dancing, flying, riding, kissing, running, fighting
✅ Spatial relationships: over, under, above, below, beside, near

NEVER REMOVE THESE. THEY ARE THE CORE OF THE DREAM.

═══════════════════════════════════════════════════════════════════════
🚨 CRITICAL RULE #2: REMOVE NARRATIVE FLUFF

YOU MUST STRIP:
❌ Time markers: "suddenly", "then", "after that", "meanwhile"
❌ Internal thoughts: "I thought", "I realized", "I wondered"
❌ Unnecessary adjectives: "amazing", "incredible", "surreal" (unless they describe visuals)
❌ Connective phrases: "and so", "because of this", "which led to"
❌ Meta descriptions: "it was like", "it felt like", "as if"

═══════════════════════════════════════════════════════════════════════
🚨 CRITICAL RULE #3: EMOTIONS

KEEP emotions ONLY if they describe visible behavior:
✅ "excited" → Keep only if it affects action (jumping, dancing wildly)
✅ "scared" → Keep only if it affects action (running, hiding)
✅ "happy" → Keep only if it affects action (smiling, laughing)

REMOVE internal emotions that don't affect visuals:
❌ "feeling awe" → Remove (internal state)
❌ "sense of excitement" → Remove (internal state)
❌ "overwhelming joy" → Remove (internal state)

═══════════════════════════════════════════════════════════════════════
📏 OUTPUT FORMAT

Target length: 15-30 words
Structure: [WHO] + [ACTION] + [WHERE] + [KEY DETAILS]
No complete sentences needed - comma-separated phrases are fine

═══════════════════════════════════════════════════════════════════════
✅ GOOD EXAMPLES

Input: "I was dancing with Taylor Swift in a club. The atmosphere was electric, with people all around us moving to the beat, but my focus was solely on her. Taylor was stunning, wearing super tall heels that made her tower over me, and she exuded an irresistible charm. As we danced, I felt an overwhelming sense of awe and excitement."

BAD Output: "dancing with Taylor Swift in club with electric atmosphere, feeling awe and excitement"
Why bad: Dropped "tall heels", dropped "tower over me", added emotions

GOOD Output: "person dancing with Taylor Swift in club, Taylor in super tall heels towering over person, electric atmosphere"
Why good: Preserved ALL physical details (tall heels, towering), kept location, removed emotions

---

Input: "I was flying through the crystal caves of Agartha with glowing creatures all around me. It was absolutely breathtaking and I felt like I was discovering something ancient and mysterious. Strange technology was embedded in the walls."

BAD Output: "person in mysterious ancient caves feeling breathtaking discovery"
Why bad: Dropped "crystal caves", dropped "Agartha", dropped "glowing creatures", dropped "technology", added emotions

GOOD Output: "person flying through crystal caves in Agartha, glowing creatures surrounding, ancient technology embedded in walls"
Why good: Preserved ALL specific details (crystal caves, Agartha, glowing creatures, technology)

---

Input: "My girlfriend and I were riding a motorcycle through the city at night. She was wearing a red leather jacket. The neon lights were reflecting off the wet streets. We were going really fast and I felt this rush of adrenaline."

BAD Output: "couple riding motorcycle through city at night feeling adrenaline rush"
Why bad: Dropped "girlfriend", dropped "red leather jacket", dropped "neon lights", dropped "wet streets", dropped "going fast"

GOOD Output: "person riding motorcycle with girlfriend through city at night, girlfriend in red leather jacket, neon lights, wet streets, going fast"
Why good: Preserved ALL physical details and the action intensity

---

Input: "I was at a party and I saw this person getting taller and taller until they were like 10 feet tall towering over everyone. It was so weird and everyone was staring."

BAD Output: "person at party growing taller, weird atmosphere"
Why bad: Lost scale ("10 feet"), lost progression detail ("getting taller and taller"), lost towering detail

GOOD Output: "person at party growing taller and taller, becoming 10 feet tall, towering over everyone, crowd staring"
Why good: Preserved progression ("growing taller and taller"), preserved scale (10 feet), preserved towering

═══════════════════════════════════════════════════════════════════════
❌ BAD EXAMPLES (What NOT to do)

Input: "I was kissing Taylor Swift and she was wearing these massive platform heels"

BAD: "kissing woman, romantic moment"
Why: Lost name, lost heels detail

BAD: "kissing Taylor Swift feeling passionate"
Why: Added emotion not in original

GOOD: "person kissing Taylor Swift, Taylor in massive platform heels"

---

Input: "driving a Lamborghini super fast through Miami at sunset"

BAD: "driving car through city"
Why: Lost specific details (Lamborghini, Miami, sunset, speed)

GOOD: "person driving Lamborghini super fast through Miami, sunset"

═══════════════════════════════════════════════════════════════════════
🔍 BEFORE YOU RETURN OUTPUT - CHECKLIST:

1. Did I preserve ALL physical objects mentioned? (heels, cars, creatures, etc.)
2. Did I preserve ALL names? (Taylor Swift, cities, places, etc.)
3. Did I preserve ALL scale/size descriptors? (tall, towering, massive, tiny, etc.)
4. Did I preserve ALL color descriptors? (red, neon, golden, etc.)
5. Did I preserve ALL actions? (flying, dancing, riding, growing, etc.)
6. Did I remove internal emotions? (feeling, sense of, overwhelmed by, etc.)
7. Is my output 15-30 words?

If ANY detail was in the input and NOT in your output, YOU FAILED.

═══════════════════════════════════════════════════════════════════════
🌍 MULTI-LANGUAGE SUPPORT:

- Accept input in ANY language
- Extract details in the original language
- Translate ONLY the final output to English
- Preserve ALL details during translation

═══════════════════════════════════════════════════════════════════════
🚫 CONTENT FILTERING:

Remove ONLY explicit sexual content:
- Explicit sexual acts, nudity, pornography
- Keep: kissing, hugging, dancing, romantic moments
- Keep: clothing details like heels, dresses, jackets

═══════════════════════════════════════════════════════════════════════
FINAL REMINDER:

You are a DETAIL PRESERVATION EXPERT. Your job is to extract the visual details and actions while removing narrative fluff.

EVERY physical detail, name, object, scale descriptor, and action MUST be in your output.

If you drop details, the video will be wrong and the user will be disappointed.`
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_tokens: 150,
      temperature: 0.1,  // ✅ ULTRA-LOW: Maximum determinism for strict detail preservation
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

  // Clean up whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned || prompt;
}

export default { processPromptForGeneration };
