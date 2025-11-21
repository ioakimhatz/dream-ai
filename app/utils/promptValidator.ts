// app/utils/promptValidator.ts - LANGUAGE-AWARE EXPLICIT CONTENT DETECTION
export interface PromptAnalysis {
  strength: 'WEAK' | 'FAIR' | 'GOOD' | 'EXCELLENT';
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
  canGenerate: boolean;
  hasAdultContent?: boolean;
}

// 🔥 DEDUPLICATION: Track running generations
const runningGenerations = new Map<string, number>(); // key -> timestamp
const generationHistory = new Map<string, number[]>(); // userId -> [timestamps]

// 🔥 RATE LIMITING: Track user generation counts
const userRateLimits = new Map<string, { count: number; resetTime: number }>();

/**
 * Check if this generation is already running (prevent duplicates)
 */
export function checkDuplicateGeneration(userId: string, prompt: string): void {
  const key = `${userId}:${prompt.slice(0, 50)}`;
  const now = Date.now();

  // Check if already running (within last 2 minutes)
  const runningTime = runningGenerations.get(key);
  if (runningTime && now - runningTime < 120000) { // 2 minutes
    console.log('🚫 DUPLICATE BLOCKED:', key);
    throw new Error('This dream is already being generated. Please wait!');
  }

  console.log('✅ No duplicate detected');
}

/**
 * Mark generation as started
 */
export function markGenerationStart(userId: string, prompt: string): void {
  const key = `${userId}:${prompt.slice(0, 50)}`;
  const now = Date.now();

  runningGenerations.set(key, now);
  console.log('🔒 Generation lock acquired:', key);
}

/**
 * Clear generation lock (call when done or on error)
 */
export function clearGenerationLock(userId: string, prompt: string): void {
  const key = `${userId}:${prompt.slice(0, 50)}`;
  runningGenerations.delete(key);
  console.log('🔓 Generation lock released:', key);
}

/**
 * Check rate limit (3 generations per 5 minutes)
 */
export function checkRateLimit(userId: string): void {
  const now = Date.now();
  const rateLimit = userRateLimits.get(userId);

  // Reset if time expired
  if (!rateLimit || now > rateLimit.resetTime) {
    userRateLimits.set(userId, {
      count: 1,
      resetTime: now + 5 * 60 * 1000 // 5 minutes
    });
    console.log('✅ Rate limit OK (new window)');
    return;
  }

  // Check if exceeded
  if (rateLimit.count >= 3) {
    const waitSeconds = Math.ceil((rateLimit.resetTime - now) / 1000);
    console.log('🚫 RATE LIMIT HIT:', userId);
    throw new Error(`Too many generations. Please wait ${waitSeconds} seconds.`);
  }

  // Increment count
  rateLimit.count++;
  console.log(`✅ Rate limit OK (${rateLimit.count}/3)`);
}

/**
 * Log generation for history tracking
 */
export function logGeneration(userId: string): void {
  const now = Date.now();
  const history = generationHistory.get(userId) || [];

  // Keep last 10 generations
  history.push(now);
  if (history.length > 10) {
    history.shift();
  }

  generationHistory.set(userId, history);
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  // Clean running generations older than 5 minutes
  for (const [key, timestamp] of runningGenerations.entries()) {
    if (now - timestamp > fiveMinutes) {
      runningGenerations.delete(key);
      console.log('🧹 Cleaned stale generation lock:', key);
    }
  }

  // Clean rate limits that have expired
  for (const [userId, limit] of userRateLimits.entries()) {
    if (now > limit.resetTime) {
      userRateLimits.delete(userId);
    }
  }
}, 5 * 60 * 1000);

// ===== LANGUAGE-AWARE EXPLICIT CONTENT DETECTION =====

/**
 * 🌍 ORGANIZED BY LANGUAGE
 * Each language has its own keyword set
 * We ONLY check the user's selected language + English (universal fallback)
 */

// 🇬🇧 ENGLISH - Always checked as base language
const ENGLISH_EXPLICIT_KEYWORDS = [
  // Sexual acts
  'fuck', 'fucked', 'fucking', 'fucker', 'fucks', 'fuk', 'fck', 'f*ck', 'f**k', 'fvck', 'phuck', 'fack', 'fook',
  'sex', 'sexed', 'sexing', 'sexual', 'sexuality', 's3x', 's*x',
  'rape', 'raped', 'raping', 'rapist',
  'blowjob', 'blow job', 'bj', 'handjob', 'hand job', 'hj', 'footjob',
  'oral', 'anal', 'vaginal',
  'penetrate', 'penetrated', 'penetrating', 'penetration',
  'bang', 'banged', 'banging', 'banger',
  'screw', 'screwed', 'screwing',
  'hump', 'humped', 'humping',
  'mounted', 'mounting',
  'breed', 'breeding',
  'seduce', 'seduced', 'seducing', 'seduction',
  'fondle', 'fondled', 'fondling',
  'grope', 'groped', 'groping',
  'molest', 'molested', 'molesting', 'molestation',
  'masturbate', 'masturbated', 'masturbating', 'masturbation',
  'jerk off', 'jerked off', 'jerking off', 'jerkoff',
  'wank', 'wanked', 'wanking', 'wanker',
  'cum', 'cumming',
  'orgasm', 'orgasmic', 'climax',
  'ejaculate', 'ejaculated', 'ejaculating', 'ejaculation',
  'intercourse', 'coitus',

  // Body parts - SEXUAL CONTEXT
  'dick', 'dicks', 'd1ck', 'd!ck', 'cock', 'cocks', 'penis', 'penises', 'member',
  'pussy', 'pussies', 'p*ssy', 'pu$$y', 'vagina', 'vaginas', 'cunt', 'cunts', 'c*nt',
  'tit', 'tits', 'titty', 'titties', 'boob', 'boobs', 'breast', 'breasts',
  'ass', 'asses', 'a$$', 'azz', '@ss', 'butt', 'butts', 'anus', 'asshole', 'arsehole',
  'balls', 'testicle', 'testicles', 'scrotum', 'sack',
  'nipple', 'nipples', 'nip', 'nips',
  'clit', 'clitoris',
  'labia', 'vulva',
  'shaft', 'tip',
  'boner', 'erection', 'hard on', 'hardon',

  // Nudity
  'nude', 'nudes', 'naked', 'nudity', 'n00dz', 'nudez',
  'topless', 'bottomless',
  'undress', 'undressed', 'undressing',
  'strip', 'stripped', 'stripping', 'stripper', 'striptease',
  'bare', 'exposed', 'revealing',
  'flash', 'flashed', 'flashing', 'flasher',

  // Pornography
  'porn', 'porno', 'pornography', 'pornographic', 'pr0n',
  'xxx', 'x-rated', 'adult film', 'adult movie',
  'nsfw', 'adult only', '18+', '18plus', 'mature content',
  'hentai', 'ecchi', 'doujin',

  // Sexual descriptions
  'erotic', 'erotica', 'sensual', 'seductive',
  'kinky', 'fetish', 'kink',
  'lewd', 'lascivious', 'lustful',
  'vulgar', 'obscene', 'indecent', 'filthy', 'dirty',
  'explicit', 'graphic',
  'provocative', 'suggestive',

  // Slang/crude terms
  'horny', 'aroused', 'turned on', 'hot and bothered',
  'wet', 'moist', 'dripping', 'soaking',
  'throbbing', 'pulsing', 'twitching',
  'thrust', 'thrusting', 'ram', 'ramming', 'slam', 'slamming',
  'pound', 'pounded', 'pounding', 'drill', 'drilling',
  'ride', 'riding', 'rode',
  'stroke', 'stroking', 'stroked', 'rub', 'rubbing',
  'suck', 'sucked', 'sucking', 'sucker', 'suckle',
  'lick', 'licked', 'licking',
  'eat out', 'eaten out', 'eating out',
  'go down', 'going down', 'went down',
  'swallow', 'swallowed', 'swallowing', 'gulp',
  'spit', 'spitting', 'spat',
  'spread', 'spreading', 'open up',
  'bend over', 'bent over', 'bending over',
  'on top', 'from behind',
  'doggy', 'doggie', 'doggystyle', 'doggy style',
  '69', 'sixty nine', 'sixtynine',
  'missionary', 'cowgirl', 'reverse cowgirl',

  // BDSM/Fetish
  'bdsm', 'bondage', 'dominance', 'submission', 'sadism', 'masochism',
  'dom', 'sub', 'domme',
  'whipped', 'whipping',
  'spank', 'spanked', 'spanking',
  'gag', 'gagged', 'gagging',
  'choke', 'choked', 'choking',
  'bound', 'restrain', 'restrained',
  'rubber',

  // Prostitution
  'prostitute', 'prostitution', 'whore', 'hooker', 'escort',
  'pimp', 'pimping', 'brothel',

  // Inappropriate acts
  'incest', 'incestuous',
  'pedophile', 'pedophilia', 'pedo', 'child molester',
  'bestiality', 'zoophilia',
  'necrophilia',
  'child porn', 'cp', 'cheese pizza',
];

// 🇬🇷 GREEK
const GREEK_EXPLICIT_KEYWORDS = [
  'gamao', 'γαμάω', 'gamaw', 'gamoto', 'gamise', 'gamhse',
  'poutana', 'πουτάνα', 'poutanos',
  'malaka', 'μαλάκα', 'malakas', 'μαλάκας',
  'arxidi', 'αρχίδι', 'arhidi',
  'psoli', 'ψωλή', 'psolli', 'psole',
  'mouni', 'μουνί', 'mounaki',
  'kolo', 'κωλο', 'kolos',
];

// 🇪🇸 SPANISH
const SPANISH_EXPLICIT_KEYWORDS = [
  'puta', 'puto', 'putita', 'putito',
  'verga', 'pene',
  'coger', 'cojo', 'coge', 'cogiendo',
  'chingar', 'chingada', 'chingado', 'chinga',
  'pinga', 'pija',
  'concha', 'chocha', 'chucha',
  'pendejo', 'pendeja', 'cabron', 'cabrona',
  'culo', 'nalgas',
  'tetas', 'chichis',
  'follar', 'follo', 'follando',
];

// 🇫🇷 FRENCH
const FRENCH_EXPLICIT_KEYWORDS = [
  'baiser', 'baise', 'baisant',
  'bite', 'queue',
  'chatte', 'con',
  'putain', 'pute', 'salope',
  'branler', 'branle', 'branlette',
  'niquer', 'nique',
];

// 🇵🇹 PORTUGUESE
const PORTUGUESE_EXPLICIT_KEYWORDS = [
  'foder', 'foda', 'fodendo',
  'puta', 'puto', 'putaria',
  'caralho', 'cacete',
  'buceta', 'xana',
  'cu', 'bunda',
];

// 🇮🇹 ITALIAN
const ITALIAN_EXPLICIT_KEYWORDS = [
  'cazzo', 'cazzi',
  'figa', 'fregna',
  'puttana', 'troia',
  'scopare', 'scopo', 'scopata',
  'culo',
];

// 🇩🇪 GERMAN
const GERMAN_EXPLICIT_KEYWORDS = [
  'ficken', 'fick', 'gefickt',
  'schwanz', 'pimmel',
  'fotze', 'muschi',
  'hure', 'schlampe',
  'arsch',
];

// 🇷🇺 RUSSIAN (romanized)
const RUSSIAN_EXPLICIT_KEYWORDS = [
  'blyat', 'bljad', 'blyad',
  'hui', 'huy', 'khuy',
  'pizda', 'pizdet',
  'yebat', 'ebat', 'ebal',
  'suka',
];

// 🇸🇦 ARABIC (romanized)
const ARABIC_EXPLICIT_KEYWORDS = [
  'kos', 'koss', 'kus',
  'ayr', 'eir', 'air',
  'neek', 'nik', 'naik',
  'sharmouta', 'sharmota', 'sharmuta',
  'kalb', 'kelb',
];

// 🇨🇳 CHINESE (pinyin)
const CHINESE_EXPLICIT_KEYWORDS = [
  'cao', // fuck
  'bi', // pussy (when used alone)
  'jiba', 'jb', // dick
];

/**
 * 🌍 Language code mapping
 * Maps React Native locale codes to keyword sets
 */
const LANGUAGE_KEYWORD_MAP: Record<string, string[]> = {
  'en': ENGLISH_EXPLICIT_KEYWORDS,
  'el': GREEK_EXPLICIT_KEYWORDS, // Greek
  'es': SPANISH_EXPLICIT_KEYWORDS,
  'fr': FRENCH_EXPLICIT_KEYWORDS,
  'pt': PORTUGUESE_EXPLICIT_KEYWORDS,
  'it': ITALIAN_EXPLICIT_KEYWORDS,
  'de': GERMAN_EXPLICIT_KEYWORDS,
  'ru': RUSSIAN_EXPLICIT_KEYWORDS,
  'ar': ARABIC_EXPLICIT_KEYWORDS,
  'zh': CHINESE_EXPLICIT_KEYWORDS,
};

/**
 * Detect adult content using ONLY the user's language + English
 * 
 * @param text - The prompt text to check
 * @param userLanguage - User's selected language code (e.g., 'el' for Greek, 'es' for Spanish)
 * @returns true if adult content detected
 */
export function detectAdultContent(text: string, userLanguage: string = 'en'): boolean {
  const lowerText = text.toLowerCase();

  // Build keyword list for this specific user
  let keywordsToCheck = [...ENGLISH_EXPLICIT_KEYWORDS]; // Always check English

  // Add user's language keywords if not English
  if (userLanguage !== 'en' && LANGUAGE_KEYWORD_MAP[userLanguage]) {
    keywordsToCheck = [...keywordsToCheck, ...LANGUAGE_KEYWORD_MAP[userLanguage]];
    console.log(`🌍 Checking ${userLanguage.toUpperCase()} + English keywords`);
  } else {
    console.log('🌍 Checking English keywords only');
  }

  // Check each keyword
  const matchedKeywords: string[] = [];
  for (const keyword of keywordsToCheck) {
    if (lowerText.includes(keyword)) {
      matchedKeywords.push(keyword);
    }
  }

  const detected = matchedKeywords.length > 0;

  console.log('🔍 Checking prompt:', text);
  console.log('🔍 User language:', userLanguage);
  console.log('🔍 Adult content detected:', detected);
  if (detected) {
    console.log('🔍 Matched keywords:', matchedKeywords);
  }

  return detected;
}

// ===== EXISTING VALIDATION CODE (UNCHANGED) =====

export function analyzePromptStrength(prompt: string, userLanguage: string = 'en'): PromptAnalysis {
  const text = prompt.trim().toLowerCase();
  let score = 0;
  const issues: string[] = [];
  const suggestions: string[] = [];

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
    score += 40;
  }

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

  const qualityWords = [
    'happy', 'sad', 'love', 'joy', 'peaceful', 'excited', 'calm', 'nostalgic',
    'proud', 'gentle', 'kind', 'caring', 'worried', 'content', 'serene',
    'walk', 'walking', 'run', 'running', 'dance', 'dancing', 'sit', 'sitting',
    'home', 'house', 'garden', 'park', 'beach', 'forest', 'room', 'kitchen',
    'friend', 'family', 'mother', 'father', 'sister', 'brother', 'grandmother',
    'beautiful', 'warm', 'soft', 'gentle', 'bright', 'dark', 'big', 'small'
  ];

  const qualityCount = qualityWords.filter(word =>
    text.includes(word) || text.includes(word + 'ing') || text.includes(word + 'ed')
  ).length;

  if (qualityCount >= 3) {
    score += 30;
  } else if (qualityCount >= 2) {
    score += 20;
  } else if (qualityCount >= 1) {
    score += 10;
  }

  // 🔥 CHECK FOR ADULT CONTENT WITH USER'S LANGUAGE
  const hasAdultContent = detectAdultContent(prompt, userLanguage);

  let strength: 'WEAK' | 'FAIR' | 'GOOD' | 'EXCELLENT';
  let canGenerate = true;

  if (wordCount < 8) {
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

  // 🔥 OVERRIDE EVERYTHING IF ADULT CONTENT DETECTED
  if (hasAdultContent) {
    canGenerate = false;
    strength = 'WEAK';
    score = 0;
    issues.push('⚠️ Inappropriate content detected');
    suggestions.push('Please keep your dreams family-friendly');
  }

  if (wordCount < 8 && !hasAdultContent) {
    if (wordCount < 3) {
      suggestions.push('Start with: WHO were you with? WHAT were you doing? WHERE did it happen?');
    } else if (wordCount < 6) {
      suggestions.push('Add more details: How did you FEEL? What did the place LOOK like?');
    } else {
      suggestions.push('Almost ready! Add the SETTING (beach, home, forest) or TIME (sunset, morning)');
    }
  } else if (!hasAdultContent) {
    const hasEmotion = qualityWords.filter(word =>
      ['happy', 'sad', 'love', 'joy', 'peaceful', 'excited', 'calm', 'feel'].includes(word) && text.includes(word)
    ).length > 0;

    const hasLocation = qualityWords.filter(word =>
      ['home', 'house', 'garden', 'park', 'beach', 'forest', 'room', 'kitchen'].includes(word) && text.includes(word)
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
    score: hasAdultContent ? 0 : Math.min(100, score),
    issues: issues.slice(0, 1),
    suggestions: suggestions.slice(0, 1),
    canGenerate,
    hasAdultContent
  };
}

export function getStrengthMessage(analysis: PromptAnalysis): string {
  // 🔥 PRIORITY: Show adult content warning FIRST
  if (analysis.hasAdultContent) {
    return '⚠️ Inappropriate content - keep your dreams family-friendly';
  }

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
  // 🔥 BRIGHT RED for adult content
  if (analysis.hasAdultContent) {
    return '#ff0000';
  }

  if (!analysis.canGenerate) {
    return '#ff6b6b';
  }

  switch (analysis.strength) {
    case 'WEAK':
      return '#ff9500';
    case 'FAIR':
      return '#ffd93d';
    case 'GOOD':
      return '#10B981';
    case 'EXCELLENT':
      return '#7C3AED';
    default:
      return '#999999';
  }
}

export const EXAMPLE_PROMPTS = [
  "Flying over my childhood home with my best friend on a sunny afternoon",
  "Dancing with my grandmother in her rose garden during golden sunset hour",
  "Walking on the beach with my golden retriever feeling peaceful and free",
  "Sitting by a campfire with my family under the starry night sky",
  "Running through a field of sunflowers feeling happy and alive in summer"
];

export function getContextGuidance(wordCount: number): string {
  if (wordCount < 3) {
    return "🎬 Think: WHO were you with? WHAT were you doing? WHERE did it happened?";
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