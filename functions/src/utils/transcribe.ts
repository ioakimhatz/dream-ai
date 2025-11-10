// functions/src/utils/transcribe.ts - NOT USED IN CLOUD FUNCTIONS
// Audio transcription is done client-side in the app

export async function transcribeAudio(uri: string, language?: string): Promise<string> {
  console.log('⚠️ Audio transcription not available in Cloud Functions');
  throw new Error('Audio transcription not available in Cloud Functions');
}
