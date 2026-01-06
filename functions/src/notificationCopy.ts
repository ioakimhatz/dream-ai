// functions/src/notificationCopy.ts
// Creative notification messages for wake-up dream reminders

export interface NotificationMessage {
  title: string;
  body: string;
}

export const NOTIFICATION_MESSAGES: NotificationMessage[] = [
  { title: "🔥 Dream Alert", body: "Did you dream? Don't let it vanish - record it now!" },
  { title: "💭 Still Remember?", body: "Your dream is fading... Capture it before it's gone!" },
  { title: "🎬 Cinema Time", body: "Turn that dream into a video - it only takes 30 seconds!" },
  { title: "⏰ Dream Check", body: "Morning! Did you have any dreams worth recording?" },
  { title: "✨ Dream Magic", body: "Wake up! Your dream is waiting to become a video!" },
  { title: "⚡ Quick!", body: "Dreams fade fast - record yours in 30 seconds!" },
  { title: "🚀 Viral Alert", body: "Your dream could be the next viral video!" },
  { title: "⏱️ 5 Minutes", body: "You have 5 minutes before your dream fades..." },
  { title: "🎥 Action!", body: "Lights, camera, dream! Record yours now!" },
  { title: "💨 Hurry!", body: "Just woke up? Your dream won't wait!" },
  { title: "🧠 Brain Cinema", body: "What did your brain create last night?" },
  { title: "🌟 Dream Time", body: "Ready to turn last night's adventure into magic?" },
  { title: "👀 Don't Miss", body: "Your last dream was amazing - what about today's?" },
  { title: "🎯 Daily Dream", body: "Record today's dream before it disappears!" },
  { title: "🔮 Vision Quest", body: "Your subconscious has a message... capture it!" },
];

/**
 * Get a random notification message
 */
export function getRandomMessage(): NotificationMessage {
  const index = Math.floor(Math.random() * NOTIFICATION_MESSAGES.length);
  return NOTIFICATION_MESSAGES[index];
}
