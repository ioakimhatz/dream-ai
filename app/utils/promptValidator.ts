// app/utils/promptValidator.ts - SIMPLIFIED VALIDATION (USER FRIENDLY)
export interface PromptAnalysis {
  strength: 'WEAK' | 'FAIR' | 'GOOD' | 'EXCELLENT';
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
  canGenerate: boolean;
  hasAdultContent?: boolean; // ADD THIS LINE
}

// ADD THIS FUNCTION - Detect 18+ content
export function detectAdultContent(text: string): boolean {
  const lowerText = text.toLowerCase();
  
  // Keywords that actually break the model
  const adultKeywords = [
    'nude', 'naked', 'nsfw', 'explicit', 'erotic',
    'porn', 'xxx', 'adult only', '18+', 'nudity',
    'topless', 'lewd', 'vulgar', 'obscene' , 'fucking'
  ];
  
  const detected = adultKeywords.some(keyword => lowerText.includes(keyword));
  
  // DEBUG
  console.log('🔍 Checking prompt:', text);
  console.log('🔍 Adult content detected:', detected);
  console.log('🔍 Matched keywords:', adultKeywords.filter(keyword => lowerText.includes(keyword)));
  
  return detected;
}

export function analyzePromptStrength(prompt: string): PromptAnalysis {
  const text = prompt.trim().toLowerCase();
  let score = 0;
  const issues: string[] = [];
  const suggestions: string[] = [];

  // MUCH MORE RELAXED VALIDATION - Let users dream freely!
  
  // 1. WORD COUNT REQUIREMENT (0-40 points) - Need at least 8 words for context
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  if (wordCount < 3) {
    issues.push('Your dream needs more details to create magic');
    suggestions.push('Describe WHO you were with, WHAT you were doing, and WHERE it happened');
    score += 0;
  } else if (wordCount < 6) {
    issues.push('Getting better! Add a few more details');
    suggestions.push('Tell us about the setting, your emotions, or what you were doing');
    score += 10;
  } else if (wordCount < 8) {
    issues.push('Almost there! Just need a bit more context');
    suggestions.push('Add details about the place, time of day, or how you felt');
    score += 20;
  } else if (wordCount < 12) {
    score += 35;
  } else {
    score += 40; // Perfect length with good context
  }

  // 2. CONTENT PRESENCE (0-40 points) - Just check if there's actual content
  if (text.length < 3) {
    issues.push('Your dream needs a few more details');
    score += 0;
  } else if (text.length < 10) {
    score += 20;
  } else if (text.length < 20) {
    score += 30;
  } else {
    score += 40;
  }

  // 3. BASIC QUALITY INDICATORS (0-30 points) - Bonus for good content
  const qualityWords = [
    // Emotions - any emotion is good
    'happy', 'sad', 'love', 'joy', 'peaceful', 'excited', 'calm', 'nostalgic',
    'proud', 'gentle', 'kind', 'caring', 'worried', 'content', 'serene',
    'amazed', 'surprised', 'grateful', 'hopeful', 'relaxed', 'confident',
    'feel', 'feeling', 'felt',
    
    // Actions - any action is good
    'walk', 'walking', 'run', 'running', 'dance', 'dancing', 'sit', 'sitting',
    'stand', 'standing', 'play', 'playing', 'laugh', 'laughing', 'smile', 'smiling',
    'hug', 'hugging', 'talk', 'talking', 'sing', 'singing', 'fly', 'flying',
    
    // Places - any location is good
    'home', 'house', 'garden', 'park', 'beach', 'forest', 'room', 'kitchen',
    'school', 'work', 'city', 'mountain', 'lake', 'ocean', 'sky', 'cloud',
    'street', 'road', 'field', 'tree', 'flower', 'river', 'bridge',
    
    // People - relationships are great
    'friend', 'family', 'mother', 'father', 'sister', 'brother', 'grandmother',
    'grandfather', 'child', 'baby', 'person', 'people', 'together',
    
    // Descriptive words - any description helps
    'beautiful', 'warm', 'soft', 'gentle', 'bright', 'dark', 'big', 'small',
    'old', 'new', 'red', 'blue', 'green', 'yellow', 'white', 'black',
    'golden', 'silver', 'colorful', 'quiet', 'loud', 'fast', 'slow'
  ];

  const qualityCount = qualityWords.filter(word => 
    text.includes(word) || text.includes(word + 'ing') || text.includes(word + 'ed')
  ).length;

  if (qualityCount >= 3) {
    score += 30; // Great detail
  } else if (qualityCount >= 2) {
    score += 20; // Good detail
  } else if (qualityCount >= 1) {
    score += 10; // Some detail
  }

  // CHECK FOR ADULT CONTENT
  const hasAdultContent = detectAdultContent(prompt);

  // DETERMINE STRENGTH - Require 8+ words for generation
  let strength: 'WEAK' | 'FAIR' | 'GOOD' | 'EXCELLENT';
  let canGenerate = true;

  if (wordCount < 8) {
    // Block generation if less than 8 words - we need context!
    canGenerate = false;
    if (score < 15) {
      strength = 'WEAK';
    } else {
      strength = 'FAIR';
    }
  } else if (score < 50) {
    strength = 'FAIR';
    canGenerate = true;
  } else if (score < 75) {
    strength = 'GOOD';
    canGenerate = true;
  } else {
    strength = 'EXCELLENT';
    canGenerate = true;
  }

  // BLOCK GENERATION IF ADULT CONTENT DETECTED
  if (hasAdultContent) {
    canGenerate = false;
  }

  // CONTEXTUAL GUIDANCE - Help users build better prompts
  if (wordCount < 8) {
    // Need more words - give specific guidance
    if (wordCount < 3) {
      suggestions.push('Start with: WHO were you with? WHAT were you doing? WHERE did it happen?');
    } else if (wordCount < 6) {
      suggestions.push('Add more details: How did you FEEL? What did the place LOOK like?');
    } else {
      suggestions.push('Almost ready! Add the SETTING (beach, home, forest) or TIME (sunset, morning)');
    }
  } else {
    // Good word count - optimize for quality
    const hasEmotion = qualityWords.filter(word => 
      ['happy', 'sad', 'love', 'joy', 'peaceful', 'excited', 'calm', 'nostalgic', 'proud', 'gentle', 'feel', 'feeling', 'felt'].includes(word) && text.includes(word)
    ).length > 0;
    
    const hasLocation = qualityWords.filter(word => 
      ['home', 'house', 'garden', 'park', 'beach', 'forest', 'room', 'kitchen', 'school', 'city', 'mountain', 'lake'].includes(word) && text.includes(word)
    ).length > 0;
    
    const hasPeople = qualityWords.filter(word => 
      ['friend', 'family', 'mother', 'father', 'sister', 'brother', 'grandmother', 'grandfather', 'with'].includes(word) && text.includes(word)
    ).length > 0;

    if (score >= 75) {
      suggestions.push('Perfect dream! Our AI will create cinema magic from this ✨');
    } else if (!hasEmotion && !hasLocation) {
      suggestions.push('Great start! Try adding HOW you felt or WHERE it happened for even better results');
    } else if (!hasEmotion) {
      suggestions.push('Nice details! Adding your EMOTIONS (happy, peaceful, excited) makes it even better');
    } else if (!hasLocation) {
      suggestions.push('Good emotion! Adding the SETTING (garden, beach, home) makes it more vivid');
    } else {
      suggestions.push('Excellent dream description! Ready for AI enhancement 🎬');
    }
  }

  return {
    strength,
    score: Math.min(100, score),
    issues: issues.slice(0, 1), // Only show 1 issue max
    suggestions: suggestions.slice(0, 1), // Only show 1 suggestion max
    canGenerate,
    hasAdultContent // ADD THIS
  };
}

// HELPER FUNCTIONS - Clear guidance based on word count
export function getStrengthMessage(analysis: PromptAnalysis): string {
  const wordCount = analysis.score >= 20 ? 8 : analysis.score >= 10 ? 6 : 3; // Estimate word count from score
  
  if (!analysis.canGenerate) {
    return '💭 Need at least 8 words to create your dream cinema';
  }
  
  switch (analysis.strength) {
    case 'WEAK':
      return '💭 Tell us more: WHO, WHAT, WHERE in your dream?';
    case 'FAIR':
      return '🌟 Good context! Our AI will make this incredible';
    case 'GOOD':
      return '✨ Great dream details! Ready for enhancement';
    case 'EXCELLENT':
      return '🎬 Perfect! Cinema-quality dream incoming!';
    default:
      return '';
  }
}

export function getStrengthColor(analysis: PromptAnalysis): string {
  if (!analysis.canGenerate) {
    return '#ff6b6b'; // Red for insufficient context
  }
  
  switch (analysis.strength) {
    case 'WEAK':
      return '#ff9500'; // Orange - needs more
    case 'FAIR':
      return '#ffd93d'; // Yellow - getting there
    case 'GOOD':
      return '#10B981'; // Green - good to go
    case 'EXCELLENT':
      return '#7C3AED'; // Purple - perfect
    default:
      return '#999999';
  }
}

// BETTER EXAMPLES - Show the 8+ word minimum with context
export const EXAMPLE_PROMPTS = [
  "Flying over my childhood home with my best friend on a sunny afternoon",
  "Dancing with my grandmother in her rose garden during golden sunset hour", 
  "Walking on the beach with my golden retriever feeling peaceful and free",
  "Sitting by a campfire with my family under the starry night sky",
  "Running through a field of sunflowers feeling happy and alive in summer"
];

// CONTEXT BUILDING HELPERS
export function getContextGuidance(wordCount: number): string {
  if (wordCount < 3) {
    return "🎬 Think: WHO were you with? WHAT were you doing? WHERE did it happen?";
  } else if (wordCount < 6) {
    return "✨ Add: How did you FEEL? What did it LOOK like?";
  } else if (wordCount < 8) {
    return "🌟 Almost ready! Add the SETTING or TIME OF DAY";
  } else {
    return "🎥 Perfect context! Our AI will make this cinematic!";
  }
}

export function getDreamPromptTemplate(): string {
  return "I was [DOING WHAT] with [WHO] in [WHERE] feeling [HOW] during [WHEN]";
}