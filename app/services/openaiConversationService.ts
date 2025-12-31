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

export function buildDreamPrompt(data: ExtractedDreamData): string {
  // Combine all raw transcripts into a coherent dream description
  const transcripts = data.rawTranscripts || [];

  if (transcripts.length === 0) {
    return '';
  }

  // If we have structured data, build a nice prompt
  if (data.subject || data.setting || data.emotions) {
    let prompt = 'I dreamed ';

    if (data.subject) {
      prompt += data.subject;
    }

    if (data.setting && !data.subject?.toLowerCase().includes(data.setting.toLowerCase())) {
      // Extract location from setting
      const settingLower = data.setting.toLowerCase();
      if (settingLower.includes(' at ') || settingLower.includes(' in ') || settingLower.includes(' on ')) {
        prompt += ` ${data.setting}`;
      } else {
        prompt += `. ${data.setting}`;
      }
    }

    if (data.emotions && !prompt.toLowerCase().includes(data.emotions.toLowerCase())) {
      prompt += `. It felt ${data.emotions}`;
    }

    // Add any remaining details from transcripts that weren't captured
    const combinedText = prompt.toLowerCase();
    transcripts.forEach(t => {
      const tLower = t.toLowerCase();
      // If transcript has unique info not in prompt, append it
      if (!combinedText.includes(tLower.substring(0, Math.min(20, tLower.length)))) {
        prompt += `. ${t}`;
      }
    });

    return prompt.trim();
  }

  // Fallback: just combine all transcripts
  return transcripts.join('. ').trim();
}
