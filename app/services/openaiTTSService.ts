// app/services/openaiTTSService.ts
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

const OPENAI_TTS_API = 'https://api.openai.com/v1/audio/speech';

export interface TTSOptions {
  voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  model?: 'tts-1' | 'tts-1-hd';
  speed?: number;
}

export async function speakText(
  text: string,
  onComplete?: () => void,
  onStart?: () => void,  // ✅ NEW: Called when audio STARTS playing
  options: TTSOptions = {}
): Promise<Audio.Sound | null> {
  try {
    const apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }

    const voice = options.voice || 'nova';
    const model = options.model || 'tts-1';
    const speed = options.speed || 1.0;

    console.log('🔊 Generating speech for:', text.substring(0, 50) + '...');

    // Call OpenAI TTS API
    const response = await fetch(OPENAI_TTS_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: text,
        voice,
        speed,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API error:', errorText);
      throw new Error(`TTS API failed: ${response.status}`);
    }

    // Get audio as blob/arraybuffer
    const audioBlob = await response.blob();
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onloadend = async () => {
        try {
          const base64Audio = (reader.result as string).split(',')[1];

          // Save to temporary file
          const tempUri = `${FileSystem.cacheDirectory}tts_${Date.now()}.mp3`;
          await FileSystem.writeAsStringAsync(tempUri, base64Audio, {
            encoding: FileSystem.EncodingType.Base64,
          });

          console.log('✅ Audio saved to:', tempUri);

          // Load and play audio
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });

          const { sound } = await Audio.Sound.createAsync(
            { uri: tempUri },
            { shouldPlay: true, volume: 1.0 },
            (status) => {
              if (status.isLoaded && status.didJustFinish) {
                console.log('🔊 Audio playback finished');
                sound.unloadAsync();
                // Clean up temp file
                FileSystem.deleteAsync(tempUri, { idempotent: true }).catch(console.error);
                // ✅ Call completion callback
                if (onComplete) {
                  onComplete();
                }
              }
            }
          );

          console.log('🔊 Playing audio...');

          // ✅ NEW: Call onStart callback when audio actually starts
          if (onStart) {
            onStart();
          }

          resolve(sound);
        } catch (error) {
          console.error('Error loading audio:', error);
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read audio blob'));
      };

      reader.readAsDataURL(audioBlob);
    });

  } catch (error) {
    console.error('Error in TTS service:', error);
    return null;
  }
}

export async function stopSpeaking(sound: Audio.Sound | null) {
  if (sound) {
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
    } catch (error) {
      console.error('Error stopping sound:', error);
    }
  }
}
