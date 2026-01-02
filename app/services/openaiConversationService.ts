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
}

export interface ConversationResponse {
  question: string;
  extractedData: ExtractedDreamData;
  isComplete: boolean;
  shouldStop: boolean;
}

const SYSTEM_PROMPT = `You are a curious, supportive dream companion helping someone describe their dream for video generation.

Your goal is to extract:
1. SETTING: Where did it happen? (location, environment)
2. SUBJECT: What happened? (main event, action)
3. EMOTIONS: How did it feel? (feelings, mood)
4. DETAILS: Key visual details (colors, people, objects, moments)

Rules:
- Ask ONE short, specific question per turn (max 15 words)
- Be curious and supportive
- Ask scaling questions that unlock new details the user hasn't mentioned
- Don't repeat what the user already said
- Stop after 5 questions OR when you have all 4 elements above
- If the user says "that's all" or "I don't remember more", wrap up gracefully

When ready to finish:
- Respond with exactly: "I have everything I need. Let me write your dream..."
- This signals completion

Example flow:
User: "I was in a car crash"
You: "What color was the car?"

User: "It was red"
You: "Who was with you?"

User: "My friend Sarah"
You: "Where were you driving?"

User: "On the highway"
You: "How did it feel when it happened?"

User: "Scary but surreal"
You: "I have everything I need. Let me write your dream..."`;

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

    // Extract subject if first message
    if (turnCount === 1 && !updatedExtractedData.subject) {
      updatedExtractedData.subject = newTranscript;
    }

    // Check stopping conditions
    const userWantToStop = transcript.includes("that's all") ||
                          transcript.includes("don't remember") ||
                          transcript.includes("nothing else") ||
                          transcript.includes("that's it");

    const hasAllElements = Boolean(
      updatedExtractedData.setting &&
      updatedExtractedData.subject &&
      updatedExtractedData.emotions
    );

    const shouldComplete = turnCount >= 5 || hasAllElements || userWantToStop;

    // Call GPT-4o-mini for next question
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: updatedMessages,
      max_tokens: 50,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0]?.message?.content?.trim() || '';

    // Check if AI wants to complete
    const aiWantsToComplete = aiResponse.toLowerCase().includes('i have everything') ||
                             aiResponse.toLowerCase().includes('let me write');

    const isComplete = shouldComplete || aiWantsToComplete;

    return {
      question: aiResponse,
      extractedData: updatedExtractedData,
      isComplete,
      shouldStop: isComplete,
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
        model: 'gpt-4o-mini',
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
