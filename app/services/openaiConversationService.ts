// app/services/openaiConversationService.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
});

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ExtractedDreamData {
  setting?: string;
  subject?: string;
  emotions?: string;
  details?: string[];
  rawTranscripts: string[];
  peopleNames?: string[];  // ✅ NEW: Track mentioned people's names for photo prompts
}

export interface ConversationResponse {
  question: string;
  extractedData: ExtractedDreamData;
  isComplete: boolean;
  shouldStop: boolean;
  turnCount: number;  // ✅ NEW: Return incremented turn count
}

const SYSTEM_PROMPT = `You are a dream conversation guide helping someone describe their dream for video creation.

⚠️ CRITICAL: READ THE CONVERSATION HISTORY BEFORE ASKING QUESTIONS!
- If the user already answered a question, DON'T ask it again
- If they said "I was alone" or "no one", don't ask "who was with you" again
- If they said "in Miami", don't ask "where were you" again
- Move to NEW topics that haven't been covered yet
- Look at what they've ALREADY told you and ask about something DIFFERENT

CONVERSATION STRATEGY:
- Ask 3-4 HIGH-IMPACT questions maximum (quality over quantity)
- SCALE intelligently - go from broad to specific, don't over-drill
- PRIORITIZE what matters for video: WHO (people), WHAT (action), WHERE (setting), HOW (atmosphere)
- DON'T ask repetitive questions about the same topic
- Complete after 3-4 solid answers OR when you have enough for a compelling video

QUESTION PRIORITIES (ask in order of importance):
1. WHO - Any people or characters? (Critical for video - faces, relationships)
   ⚠️ IF USER MENTIONS A PERSON'S NAME → IMMEDIATELY ask: "Can you add a photo of [NAME] below so we can use their face in your dream?"
2. WHAT - What was happening? What were you doing? (The main action/event)
3. WHERE - What was the setting? (ONE question - accept brief answers like "park" or "beach")
4. HOW - How did it feel? What was the atmosphere? (Emotions, mood)
5. VISUAL DETAILS - Only ask if time permits (colors, striking objects)

INTELLIGENT SCALING RULES:
❌ BAD: "What kind of park was it?" (too specific, unnecessary)
✅ GOOD: "Who was with you in the park?" (prioritizes people)

❌ BAD: "What color was the car?" then "What kind of car?" (over-drilling)
✅ GOOD: Ask about car OR people, not both in detail

❌ BAD: If they say "beach" → "What beach?" "What part of the beach?"
✅ GOOD: If they say "beach" → Accept it, ask about people or action instead

BE SMART ABOUT COMPLETION:
- If user gives detailed answer with WHO + WHAT + WHERE → Complete!
- Don't force 5 questions if you have enough
- After 3-4 good answers, say: "I have everything I need. Let me create your dream..."

CONVERSATION FLOW EXAMPLE:
User: "I was driving a car"
You: "Who was with you?" (prioritize people over car details)

User: "My girlfriend Sarah"
You: "Where were you driving?" (now ask location)

User: "Through the mountains"
You: "How did it feel?" (emotion/atmosphere)

User: "Exciting and free"
You: "I have everything I need. Let me create your dream..." (COMPLETE - we have WHO, WHAT, WHERE, HOW)

Ask ONE concise question (max 12 words). Be natural and conversational.`;

export async function processConversationTurn(
  messages: ConversationMessage[],
  newTranscript: string,
  extractedData: ExtractedDreamData,
  turnCount: number
): Promise<ConversationResponse> {
  try {
    // Add user's new transcript
    const updatedMessages: ConversationMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...messages,
      { role: 'user', content: newTranscript },
    ];

    // Update extracted data with new transcript
    const updatedExtractedData: ExtractedDreamData = {
      ...extractedData,
      rawTranscripts: [...(extractedData.rawTranscripts || []), newTranscript],
    };

    // Simple keyword extraction for dream elements
    const transcript = newTranscript.toLowerCase();

    // Extract setting clues
    const locationWords = ['at', 'in', 'on', 'near', 'by', 'inside', 'outside', 'beach', 'house', 'car', 'school', 'work', 'street', 'highway', 'forest', 'ocean', 'mountain'];
    const hasLocation = locationWords.some(word => transcript.includes(word));
    if (hasLocation && !updatedExtractedData.setting) {
      updatedExtractedData.setting = newTranscript;
    }

    // Extract emotion clues
    const emotionWords = ['scared', 'happy', 'sad', 'angry', 'excited', 'nervous', 'peaceful', 'terrified', 'joyful', 'anxious', 'calm', 'weird', 'surreal', 'strange'];
    const hasEmotion = emotionWords.some(word => transcript.includes(word));
    if (hasEmotion && !updatedExtractedData.emotions) {
      updatedExtractedData.emotions = newTranscript;
    }

    // ✅ NEW: Extract people/character names
    const namePatterns = [
      /my friend ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      /my girlfriend ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      /my boyfriend ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      /my wife ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      /my husband ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      /with ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      /called ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
      /named ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/gi,
    ];

    const namesFound: string[] = [];
    const existingNames = updatedExtractedData.peopleNames || [];

    for (const pattern of namePatterns) {
      const matches = newTranscript.matchAll(pattern);
      for (const match of matches) {
        const name = match[1];
        // Only add if it's a valid name and not already tracked
        if (name && !existingNames.includes(name) && !namesFound.includes(name)) {
          // Exclude common words that might be capitalized
          const commonWords = ['Miami', 'Beach', 'Park', 'House', 'Car', 'Street', 'Road', 'Ocean'];
          if (!commonWords.includes(name)) {
            namesFound.push(name);
          }
        }
      }
    }

    if (namesFound.length > 0) {
      updatedExtractedData.peopleNames = [...existingNames, ...namesFound];
      console.log('✅ Detected names:', namesFound);
    }

    // Extract subject if first message
    if (turnCount === 0 && !updatedExtractedData.subject) {
      updatedExtractedData.subject = newTranscript;
    }

    // Check stopping conditions
    const userWantToStop = transcript.includes("that's all") ||
                          transcript.includes("don't remember") ||
                          transcript.includes("nothing else") ||
                          transcript.includes("that's it");

    // ✅ MUCH STRICTER: Filter out greetings and require REAL dream content
    const hasRealDreamContent = updatedExtractedData.rawTranscripts.some(t => {
      const transcript = t.toLowerCase().trim();
      // Ignore greetings and test phrases
      if (transcript === 'hey' ||
          transcript === 'hello' ||
          transcript === 'hi' ||
          transcript.includes('do you hear me') ||
          transcript.includes('can you hear me') ||
          transcript.includes('testing')) {
        return false;
      }
      // Must have actual dream keywords OR be a substantial sentence
      return transcript.includes('dream') ||
             transcript.includes('saw') ||
             transcript.includes('was') ||
             transcript.includes('were') ||
             transcript.includes('went') ||
             transcript.length > 20; // Or be a substantial sentence
    });

    const hasSubject = Boolean(updatedExtractedData.subject && hasRealDreamContent);
    const hasEnoughDetail = updatedExtractedData.rawTranscripts.length >= 3; // At least 3 turns of dialogue
    const hasLocationForCompletion = Boolean(
      updatedExtractedData.setting ||
      updatedExtractedData.rawTranscripts.some(t =>
        t.toLowerCase().includes('in ') ||
        t.toLowerCase().includes('at ') ||
        t.toLowerCase().includes('on ') ||
        t.toLowerCase().includes('beach') ||
        t.toLowerCase().includes('park') ||
        t.toLowerCase().includes('house') ||
        t.toLowerCase().includes('car')
      )
    );

    // ✅ STRICTER: Require BOTH enough detail AND enough turns
    // Don't complete early even if we have all elements
    const hasEnoughForVideo = hasSubject && hasEnoughDetail && hasLocationForCompletion && hasRealDreamContent;
    const hasMinimumTurns = turnCount >= 3; // At least 3 turns minimum

    // Only complete if:
    // 1. We have 4+ turns, OR
    // 2. We have all video elements AND 3+ turns, OR
    // 3. User explicitly wants to stop
    const shouldComplete = turnCount >= 4 || (hasEnoughForVideo && hasMinimumTurns) || userWantToStop;

    console.log('🔍 DEBUG COMPLETION CHECK:');
    console.log('  - turnCount:', turnCount);
    console.log('  - hasRealDreamContent:', hasRealDreamContent);
    console.log('  - hasSubject:', hasSubject);
    console.log('  - hasEnoughDetail:', hasEnoughDetail);
    console.log('  - hasLocationForCompletion:', hasLocationForCompletion);
    console.log('  - hasMinimumTurns:', hasMinimumTurns);
    console.log('  - hasEnoughForVideo:', hasEnoughForVideo);
    console.log('  - shouldComplete:', shouldComplete);
    console.log('  - rawTranscripts:', updatedExtractedData.rawTranscripts);
    console.log('  - peopleNames:', updatedExtractedData.peopleNames || 'none detected');

    // ✅ FIX: Build conversation summary to help AI avoid repeating questions
    const conversationSummary = updatedExtractedData.rawTranscripts.length > 0 ? `

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 WHAT THE USER HAS ALREADY TOLD YOU:
${updatedExtractedData.rawTranscripts.map((t, i) => `${i + 1}. "${t}"`).join('\n')}

✅ What we know so far:
- Subject: ${updatedExtractedData.subject || 'not yet mentioned'}
- Setting: ${updatedExtractedData.setting || 'not yet mentioned'}
- Emotions: ${updatedExtractedData.emotions || 'not yet mentioned'}
${updatedExtractedData.peopleNames && updatedExtractedData.peopleNames.length > 0
  ? `- People mentioned: ${updatedExtractedData.peopleNames.join(', ')}`
  : ''}

${updatedExtractedData.peopleNames && updatedExtractedData.peopleNames.length > 0
  ? `⚠️ IMPORTANT: User mentioned these people: ${updatedExtractedData.peopleNames.join(', ')}
  → Ask if they can add photos of these people below for better video generation!
  → Use this exact format: "Can you add a photo of [NAME] below so we can use their face in your dream?"`
  : ''}

⚠️ Ask about something NEW that hasn't been covered in the responses above!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : '';

    // ✅ FIX: Add summary to system message to prevent repetitive questions
    const messagesWithContext = [
      { role: 'system' as const, content: SYSTEM_PROMPT + conversationSummary },
      ...updatedMessages.slice(1)  // Skip the original system message (we replaced it)
    ];

    // ✅ UPGRADED: Use GPT-4o for smarter, more intelligent conversation
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',  // ✅ Upgraded from gpt-4o-mini for better intelligence
      messages: messagesWithContext,  // ✅ Use messages with context
      max_tokens: 50,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content?.trim() || '';

    console.log('🔍 DEBUG AI RESPONSE:');
    console.log('  - aiResponse:', aiResponse);

    // Check if AI wants to complete
    const aiWantsToComplete = aiResponse.toLowerCase().includes('i have everything') ||
                             aiResponse.toLowerCase().includes('let me write') ||
                             aiResponse.toLowerCase().includes('let me create');

    console.log('  - aiWantsToComplete:', aiWantsToComplete);
    console.log('  - shouldComplete (from logic):', shouldComplete);

    const isComplete = shouldComplete || aiWantsToComplete;

    console.log('  - FINAL isComplete:', isComplete);
    console.log('  - Current conversation history:', updatedExtractedData.rawTranscripts);

    return {
      question: aiResponse,
      extractedData: updatedExtractedData,
      isComplete,
      shouldStop: isComplete,
      turnCount: turnCount + 1,  // ✅ FIX: Return incremented turn count
    };

  } catch (error) {
    console.error('Error in conversation turn:', error);
    throw new Error('Failed to process conversation. Please try again.');
  }
}

/**
 * Use GPT to synthesize a coherent dream description from all transcripts
 * Cost: ~$0.001 per call (negligible compared to conversation cost)
 */
async function synthesizeDreamPrompt(transcripts: string[]): Promise<string> {
  if (transcripts.length === 0) {
    return '';
  }

  // If only one transcript, just use it directly
  if (transcripts.length === 1) {
    return `I dreamed ${transcripts[0]}`;
  }

  const conversationContext = transcripts.map((t, i) => `${i + 1}. ${t}`).join('\n');

  const synthesisPrompt = `You are helping create a dream video. The user had a conversation about their dream, answering questions one by one. Synthesize ALL the details they provided into ONE coherent dream description.

User's responses in order:
${conversationContext}

Requirements:
- Start with "I dreamed"
- Combine ALL details into a natural, flowing description
- Include ALL people, places, objects, colors, emotions mentioned
- Make it read like a story, not a list
- Keep it under 200 words
- DO NOT ask questions or add things the user didn't say

Example:
Input:
1. I was in a mustang with a blonde girl
2. Red
3. Miami
4. The coast

Output:
I dreamed I was driving a red Mustang with a blonde girl along the Miami coast.

Now synthesize this dream:`;

  try {
    const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',  // ✅ Also upgrade synthesis to GPT-4o for better quality
        messages: [
          {
            role: 'system',
            content: 'You synthesize dream descriptions from conversation fragments. Be concise and natural.'
          },
          {
            role: 'user',
            content: synthesisPrompt
          }
        ],
        max_tokens: 200,
        temperature: 0.3, // Lower temperature for consistent, accurate synthesis
      }),
    });

    const data = await response.json();
    const synthesizedPrompt = data.choices[0]?.message?.content?.trim() || '';

    console.log('🎨 GPT synthesized dream prompt:', synthesizedPrompt);

    // Fallback if GPT fails or returns empty
    if (!synthesizedPrompt) {
      console.warn('⚠️ GPT synthesis failed, using fallback');
      return `I dreamed ${transcripts.join('. ')}`;
    }

    return synthesizedPrompt;

  } catch (error) {
    console.error('❌ Error synthesizing dream prompt:', error);
    // Fallback: just join transcripts
    return `I dreamed ${transcripts.join('. ')}`;
  }
}

/**
 * Build final dream prompt from extracted data
 * Now uses GPT synthesis for better quality
 */
export async function buildDreamPrompt(data: ExtractedDreamData): Promise<string> {
  const transcripts = data.rawTranscripts || [];

  if (transcripts.length === 0) {
    console.warn('⚠️ No transcripts available for dream prompt');
    return '';
  }

  console.log('📝 Building dream prompt from transcripts:', transcripts);

  // Use GPT to synthesize a coherent prompt from all transcripts
  const synthesizedPrompt = await synthesizeDreamPrompt(transcripts);

  return synthesizedPrompt;
}
