// app/utils/transcribe.ts
import * as FileSystem from 'expo-file-system';

export async function transcribeAudio(uri: string, language: string = 'en'): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
  if (!apiKey) throw new Error('OpenAI key missing');

  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error(`Audio file not found at ${uri}`);

  const form = new FormData();
  // @ts-ignore RN file object
  form.append('file', { uri, name: 'audio.m4a', type: 'audio/m4a' });
  form.append('model', 'whisper-1');
  form.append('response_format', 'text');
  if (language) form.append('language', language);

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      // DO NOT set 'Content-Type' here; RN will add the correct multipart boundary
    },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Whisper error: ${body.slice(0,400)}`);
  }

  const text = await res.text();
  return text.trim();
}
