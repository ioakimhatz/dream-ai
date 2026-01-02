// app/contexts/ConversationContext.tsx - CONTINUOUS VOICE CONVERSATION with VAD
import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  processConversationTurn,
  buildDreamPrompt,
  ConversationMessage,
  ExtractedDreamData,
} from '../services/openaiConversationService';
import { speakText, stopSpeaking } from '../services/openaiTTSService';
import { transcribeAudio } from '../utils/transcribe';

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface ConversationContextType {
  orbState: OrbState;
  currentMessage: string | null;
  isConversationActive: boolean;
  isConversationComplete: boolean;
  extractedData: ExtractedDreamData | null;
  messages: ConversationMessage[];
  turnCount: number;

  startConversation: () => Promise<void>;
  stopConversation: () => void;
  resetConversation: () => void;
  resetRateLimit?: () => Promise<void>; // ✅ NEW: Optional for testing
  onDreamPromptReady?: (prompt: string) => void;
}

const ConversationContext = createContext<ConversationContextType | undefined>(undefined);

export function useConversation() {
  const context = useContext(ConversationContext);
  if (!context) {
    throw new Error('useConversation must be used within ConversationProvider');
  }
  return context;
}

interface ConversationProviderProps {
  children: React.ReactNode;
  onDreamPromptReady?: (prompt: string) => void;
}

const MAX_TURN_DURATION = 10; // 10 seconds max per turn (cost protection)
const SILENCE_THRESHOLD = -30; // dB level for silence detection
const SILENCE_DURATION = 1.5; // 1.5 seconds of silence triggers auto-stop
const MAX_TURNS = 5; // Maximum conversation exchanges
const INITIAL_SPEECH_TIMEOUT = 5; // 5 seconds to start speaking
const MAX_CONVERSATION_DURATION = 90; // 90 seconds (1.5 minutes)
const CONVERSATION_COOLDOWN_HOURS = 24; // 24 hours between conversations
const STORAGE_KEY_LAST_CONVERSATION = '@dream_ai_last_conversation_time';

export function ConversationProvider({ children, onDreamPromptReady }: ConversationProviderProps) {
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [isConversationComplete, setIsConversationComplete] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedDreamData | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [turnCount, setTurnCount] = useState(0);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const audioMonitorRef = useRef<NodeJS.Timeout | null>(null);
  const silenceCounterRef = useRef(0);
  const recordingDurationRef = useRef(0);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const shouldAutoResumeRef = useRef(false);
  const initialSpeechTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasDetectedSpeechRef = useRef(false);
  const conversationDurationRef = useRef(0);
  const conversationTimerRef = useRef<NodeJS.Timeout | null>(null);
  // ✅ FIX: Track extractedData in ref to avoid state desync issues
  const extractedDataRef = useRef<ExtractedDreamData>({ rawTranscripts: [] });

  // Stop recording and return URI
  const stopRecordingInternal = useCallback(async () => {
    if (!recordingRef.current) return null;

    try {
      console.log('🎤 Stopping recording...');

      // Clear monitoring interval
      if (audioMonitorRef.current) {
        clearInterval(audioMonitorRef.current);
        audioMonitorRef.current = null;
      }

      // Clear duration timer
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }

      // ✅ NEW: Clear initial speech timeout
      if (initialSpeechTimerRef.current) {
        clearTimeout(initialSpeechTimerRef.current);
        initialSpeechTimerRef.current = null;
      }

      const recording = recordingRef.current;
      recordingRef.current = null;
      recordingDurationRef.current = 0;
      silenceCounterRef.current = 0;

      await recording.stopAndUnloadAsync();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = recording.getURI();
      if (!uri) {
        throw new Error('Failed to get recording URI');
      }

      console.log('✅ Recording saved:', uri);
      return uri;
    } catch (error) {
      console.error('Error stopping recording:', error);
      return null;
    }
  }, []);

  // Process a conversation turn (transcribe + AI response + TTS)
  const processTurn = useCallback(async (audioUri: string) => {
    try {
      // Transcribe audio
      setOrbState('thinking');
      setCurrentMessage('Transcribing...');
      console.log('🎤 Transcribing audio...');

      const transcript = await transcribeAudio(audioUri, 'en');
      console.log('✅ Transcript:', transcript);

      if (!transcript || transcript.length < 3) {
        console.log('❌ Transcript too short, resuming listening...');
        setCurrentMessage('Didn\'t catch that...');
        setTimeout(() => {
          setCurrentMessage('I\'m listening...');
          startRecordingInternal(); // Auto-resume
        }, 1500);
        return;
      }

      // ✅ FIX: Log transcript but keep thinking state for GPT processing
      console.log(`📝 User said: "${transcript}"`);

      // ✅ NEW: Update message but KEEP thinking state during GPT processing
      setCurrentMessage('Processing your dream...');

      // Process conversation turn
      const newTurnCount = turnCount + 1;
      setTurnCount(newTurnCount);

      // ✅ FIX: Use ref to get latest extractedData (avoids state desync)
      console.log('🔍 DEBUG: extractedDataRef.current before processConversationTurn:', extractedDataRef.current.rawTranscripts);

      // ✅ KEEP ORB IN THINKING STATE during GPT processing
      const response = await processConversationTurn(
        messages,
        transcript,
        extractedDataRef.current, // ✅ FIX: Use ref instead of state
        newTurnCount
      );

      // ✅ ADD DEBUG LOG
      console.log('🔍 DEBUG: processTurn response.extractedData.rawTranscripts:', response.extractedData.rawTranscripts);

      // Update state
      setMessages(prev => [
        ...prev,
        { role: 'user', content: transcript },
        { role: 'assistant', content: response.question },
      ]);
      setExtractedData(response.extractedData);
      // ✅ FIX: Sync the ref with the state immediately
      extractedDataRef.current = response.extractedData;
      console.log('🔍 DEBUG: Updated extractedDataRef, rawTranscripts:', response.extractedData.rawTranscripts);

      // Check if conversation is complete
      const isComplete = response.isComplete || newTurnCount >= MAX_TURNS;

      if (isComplete) {
        console.log('✅ Conversation complete!');
        setIsConversationComplete(true);
        setIsConversationActive(false);
        shouldAutoResumeRef.current = false;

        // Build final dream prompt
        const dreamPrompt = await buildDreamPrompt(response.extractedData);
        console.log('📝 Final dream prompt:', dreamPrompt);

        // Speak completion message
        setOrbState('speaking');
        setCurrentMessage('Great! I have everything I need.');

        // ✅ FIX: Use completion callback instead of timeout
        const sound = await speakText('Great! I have everything I need.', () => {
          // This runs when TTS actually finishes playing
          console.log('🔊 Completion message finished, transitioning to idle...');
          setOrbState('idle');
          setCurrentMessage(null);

          if (onDreamPromptReady) {
            onDreamPromptReady(dreamPrompt);
          }
        });

        soundRef.current = sound;

        return;
      }

      // Speak AI's question
      setOrbState('speaking');
      setCurrentMessage(response.question);

      // ✅ FIX: Use completion callback instead of timeout
      shouldAutoResumeRef.current = true;
      const sound = await speakText(response.question, () => {
        // This runs when TTS actually finishes playing
        console.log('🔊 TTS playback completed, auto-resuming...');

        if (shouldAutoResumeRef.current) {
          console.log('🔄 Auto-resuming recording for next turn...');
          setCurrentMessage('I\'m listening...');
          startRecordingInternal(); // This will set orb to 'listening'
        }
      });

      soundRef.current = sound;
    } catch (error) {
      console.error('❌ Error processing turn:', error);
      Alert.alert('Error', 'Failed to process your message. Please try again.');
      setOrbState('idle');
      setIsConversationActive(false);
      shouldAutoResumeRef.current = false;
    }
  }, [turnCount, messages, onDreamPromptReady]); // ✅ FIX: Removed extractedData from deps since we use ref now

  // Monitor audio levels for Voice Activity Detection (VAD)
  const monitorAudioLevels = useCallback((recording: Audio.Recording) => {
    console.log('🎧 Starting audio level monitoring with REAL VAD...');

    audioMonitorRef.current = setInterval(async () => {
      if (!recordingRef.current) {
        console.log('⚠️ No recording object, stopping monitor');
        if (audioMonitorRef.current) {
          clearInterval(audioMonitorRef.current);
          audioMonitorRef.current = null;
        }
        return;
      }

      try {
        // ✅ FIX: Get REAL audio levels from recording
        const status = await recording.getStatusAsync();

        if (status.isRecording && status.metering !== undefined) {
          const audioLevel = status.metering; // Returns value in dB (usually -160 to 0)

          // ✅ FIX: Check if audio is actually silent
          // Typical speech: -35 to -10 dB
          // Keyboard/mouse clicks: -45 to -35 dB
          // Silence/background noise: < -45 dB
          const SILENCE_THRESHOLD = -35; // ✅ FIX: Stricter - only actual speech (was -45)

          if (audioLevel < SILENCE_THRESHOLD) {
            // Audio is silent - increment counter
            silenceCounterRef.current++;
            console.log(`🔇 Silence detected: ${audioLevel.toFixed(1)} dB (${silenceCounterRef.current * 100}ms)`);
          } else {
            // ✅ FIX: Audio detected - RESET counter
            if (silenceCounterRef.current > 0) {
              console.log(`🎤 Speech detected: ${audioLevel.toFixed(1)} dB - resetting silence counter`);
            }
            silenceCounterRef.current = 0;

            // ✅ NEW: First speech detected - clear the "no speech" timeout
            if (!hasDetectedSpeechRef.current) {
              hasDetectedSpeechRef.current = true;
              if (initialSpeechTimerRef.current) {
                clearTimeout(initialSpeechTimerRef.current);
                initialSpeechTimerRef.current = null;
                console.log('✅ First speech detected - cleared no-speech timeout');
              }
            }
          }

          // ✅ FIX: Stop after 1.5s silence AND minimum 0.5s recording
          if (silenceCounterRef.current >= 15) { // 15 * 100ms = 1.5s
            // Don't stop if recording is too short (prevents stopping on background noise)
            if (recordingDurationRef.current < 0.5) {
              console.log(`⏸️ Silence detected but recording too short (${recordingDurationRef.current}s), continuing...`);
              return;
            }

            console.log(`✅ Real silence detected for 1.5s after ${recordingDurationRef.current}s recording, auto-stopping...`);

            // Clear monitor before stopping to prevent multiple triggers
            if (audioMonitorRef.current) {
              clearInterval(audioMonitorRef.current);
              audioMonitorRef.current = null;
            }

            const uri = await stopRecordingInternal();
            if (uri) {
              await processTurn(uri);
            }
          }
        } else if (status.isRecording && status.metering === undefined) {
          // ✅ FALLBACK: If metering not available on this platform
          console.log('⚠️ Audio metering not available on this platform, using fallback');

          // Use simplified detection: increment every interval
          silenceCounterRef.current++;

          if (silenceCounterRef.current >= 15) {
            // Don't stop if recording is too short
            if (recordingDurationRef.current < 0.5) {
              console.log(`⏸️ Fallback: 1.5s elapsed but recording too short (${recordingDurationRef.current}s), continuing...`);
              return;
            }

            console.log(`✅ Fallback: 1.5s elapsed after ${recordingDurationRef.current}s recording, auto-stopping...`);

            if (audioMonitorRef.current) {
              clearInterval(audioMonitorRef.current);
              audioMonitorRef.current = null;
            }

            const uri = await stopRecordingInternal();
            if (uri) {
              await processTurn(uri);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error checking audio levels:', error);
        // Don't crash - just increment counter as fallback
        silenceCounterRef.current++;

        if (silenceCounterRef.current >= 15) {
          // Don't stop if recording is too short
          if (recordingDurationRef.current < 0.5) {
            return;
          }

          if (audioMonitorRef.current) {
            clearInterval(audioMonitorRef.current);
            audioMonitorRef.current = null;
          }

          const uri = await stopRecordingInternal();
          if (uri) {
            await processTurn(uri);
          }
        }
      }
    }, 100); // Check every 100ms
  }, [stopRecordingInternal, processTurn]);

  // Start recording with VAD
  const startRecordingInternal = useCallback(async () => {
    try {
      console.log('🎤 Starting recording with VAD...');

      // Request microphone permission
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow microphone access to use voice conversation.');
        return;
      }

      // Set audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Start recording with metering enabled for VAD
      const { recording } = await Audio.Recording.createAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true, // ✅ Enable audio level metering for real VAD
      });

      recordingRef.current = recording;
      setOrbState('listening');
      recordingDurationRef.current = 0;
      silenceCounterRef.current = 0;

      // Start audio level monitoring for VAD
      monitorAudioLevels(recording);

      // ✅ NEW: Start "no speech detected" timeout
      hasDetectedSpeechRef.current = false;
      initialSpeechTimerRef.current = setTimeout(() => {
        console.log('⏱️ No speech detected after 5 seconds, closing conversation...');

        // Stop recording
        stopRecordingInternal().then(() => {
          // Stop conversation and show message
          setOrbState('idle');
          setCurrentMessage(null);
          setIsConversationActive(false);
          shouldAutoResumeRef.current = false;

          // Show alert to user
          Alert.alert(
            'No Speech Detected',
            'Please tap the orb and speak your dream when ready.',
            [{ text: 'OK' }]
          );
        });
      }, INITIAL_SPEECH_TIMEOUT * 1000);

      console.log(`⏱️ Started ${INITIAL_SPEECH_TIMEOUT}s timeout for initial speech detection`);

      // Start duration timer (max 10 seconds per turn)
      durationTimerRef.current = setInterval(() => {
        recordingDurationRef.current += 1;

        // ✅ FIX: Removed broken silence reset logic
        // Silence counter is now managed by monitorAudioLevels() based on REAL audio

        // Auto-stop after 10 seconds (cost protection)
        if (recordingDurationRef.current >= MAX_TURN_DURATION) {
          console.log('⏰ Max turn duration reached (10s), auto-stopping...');
          stopRecordingInternal().then(uri => {
            if (uri) processTurn(uri);
          });
        }
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
      setOrbState('idle');
    }
  }, [monitorAudioLevels, stopRecordingInternal, processTurn]);

  // Check if user can start a new conversation (rate limiting)
  const canStartConversation = useCallback(async (): Promise<boolean> => {
    try {
      const lastConversationTime = await AsyncStorage.getItem(STORAGE_KEY_LAST_CONVERSATION);

      if (!lastConversationTime) {
        // First time user, allow conversation
        return true;
      }

      const lastTime = parseInt(lastConversationTime, 10);
      const now = Date.now();
      const hoursSinceLastConversation = (now - lastTime) / (1000 * 60 * 60);

      console.log(`⏱️ Hours since last conversation: ${hoursSinceLastConversation.toFixed(2)} / ${CONVERSATION_COOLDOWN_HOURS}`);

      if (hoursSinceLastConversation >= CONVERSATION_COOLDOWN_HOURS) {
        // Cooldown period has passed
        return true;
      }

      // Still in cooldown period
      const hoursRemaining = CONVERSATION_COOLDOWN_HOURS - hoursSinceLastConversation;
      const minutesRemaining = Math.ceil(hoursRemaining * 60);

      Alert.alert(
        'Daily Limit Reached',
        `You've used your daily dream conversation. Come back in ${minutesRemaining} minutes!`,
        [{ text: 'OK' }]
      );

      return false;
    } catch (error) {
      console.error('❌ Error checking conversation rate limit:', error);
      // On error, allow conversation (fail open)
      return true;
    }
  }, []);

  // Force conversation completion when time limit reached
  const forceConversationCompletion = useCallback(async () => {
    console.log('⏰ Forcing conversation completion due to time limit...');

    // Stop any active recording
    shouldAutoResumeRef.current = false;
    if (recordingRef.current) {
      await stopRecordingInternal();
    }

    // Build whatever dream prompt we have so far
    // ✅ FIX: Use ref to get latest extractedData
    const dreamPrompt = await buildDreamPrompt(extractedDataRef.current);
    console.log('📝 Final dream prompt (time limit):', dreamPrompt);

    // Set as complete
    setIsConversationComplete(true);
    setIsConversationActive(false);

    // Speak completion message
    setOrbState('speaking');
    setCurrentMessage('Time\'s up! Let me create your dream with what you\'ve told me.');

    // ✅ Use completion callback for smooth transition
    const sound = await speakText('Time\'s up! Let me create your dream with what you\'ve told me.', () => {
      // This runs when TTS actually finishes playing
      console.log('🔊 Time limit completion message finished');
      setOrbState('idle');
      setCurrentMessage(null);

      if (onDreamPromptReady) {
        onDreamPromptReady(dreamPrompt);
      }
    });

    soundRef.current = sound;
  }, [onDreamPromptReady, stopRecordingInternal]); // ✅ FIX: Removed extractedData from deps since we use ref now

  // Start conversation (called when user taps orb first time)
  const startConversation = useCallback(async () => {
    try {
      // ✅ NEW: Check rate limit before starting
      const canStart = await canStartConversation();
      if (!canStart) {
        console.log('⛔ Conversation blocked by rate limit');
        return;
      }

      console.log('🎬 Starting continuous voice conversation...');

      setIsConversationActive(true);
      shouldAutoResumeRef.current = true;
      setCurrentMessage('I\'m listening...');

      // ✅ NEW: Save conversation start time for rate limiting
      try {
        await AsyncStorage.setItem(STORAGE_KEY_LAST_CONVERSATION, Date.now().toString());
        console.log('✅ Conversation timestamp saved for rate limiting');
      } catch (error) {
        console.error('❌ Error saving conversation timestamp:', error);
      }

      // ✅ NEW: Start overall conversation duration timer
      conversationDurationRef.current = 0;
      conversationTimerRef.current = setInterval(() => {
        conversationDurationRef.current += 1;
        console.log(`⏱️ Conversation duration: ${conversationDurationRef.current}s / ${MAX_CONVERSATION_DURATION}s`);

        // Check if max duration reached
        if (conversationDurationRef.current >= MAX_CONVERSATION_DURATION) {
          console.log('⏱️ Max conversation duration (1.5 minutes) reached, forcing completion...');

          // Clear the timer
          if (conversationTimerRef.current) {
            clearInterval(conversationTimerRef.current);
            conversationTimerRef.current = null;
          }

          // Force conversation completion
          forceConversationCompletion();
        }
      }, 1000); // Check every second

      console.log(`⏱️ Started conversation timer - max duration: ${MAX_CONVERSATION_DURATION}s`);

      await startRecordingInternal();
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
      setOrbState('idle');
      setIsConversationActive(false);
    }
  }, [startRecordingInternal, forceConversationCompletion, canStartConversation]);

  // Stop conversation (user can tap orb during conversation to stop)
  const stopConversation = useCallback(() => {
    console.log('🛑 Stopping conversation...');

    shouldAutoResumeRef.current = false;

    // Stop recording
    if (recordingRef.current) {
      stopRecordingInternal();
    }

    // Stop speech
    if (soundRef.current) {
      stopSpeaking(soundRef.current);
      soundRef.current = null;
    }

    // Clear all timers
    if (audioMonitorRef.current) {
      clearInterval(audioMonitorRef.current);
      audioMonitorRef.current = null;
    }

    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }

    if (initialSpeechTimerRef.current) {
      clearTimeout(initialSpeechTimerRef.current);
      initialSpeechTimerRef.current = null;
    }

    // ✅ NEW: Clear conversation timer
    if (conversationTimerRef.current) {
      clearInterval(conversationTimerRef.current);
      conversationTimerRef.current = null;
    }
    conversationDurationRef.current = 0;

    setOrbState('idle');
    setIsConversationActive(false);
    setCurrentMessage(null);
  }, [stopRecordingInternal]);

  // Reset conversation
  const resetConversation = useCallback(() => {
    console.log('🔄 Resetting conversation...');

    stopConversation();

    setMessages([]);
    setExtractedData(null);
    extractedDataRef.current = { rawTranscripts: [] }; // ✅ FIX: Reset ref too
    setTurnCount(0);
    setCurrentMessage(null);
    setIsConversationComplete(false);

    // ✅ NEW: Ensure conversation duration is reset
    conversationDurationRef.current = 0;
  }, [stopConversation]);

  // Admin function to reset rate limit (for testing)
  const resetRateLimit = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY_LAST_CONVERSATION);
      console.log('✅ Rate limit reset');
      Alert.alert('Rate Limit Reset', 'You can now start a new conversation.');
    } catch (error) {
      console.error('❌ Error resetting rate limit:', error);
    }
  }, []);

  return (
    <ConversationContext.Provider
      value={{
        orbState,
        currentMessage,
        isConversationActive,
        isConversationComplete,
        extractedData,
        messages,
        turnCount,
        startConversation,
        stopConversation,
        resetConversation,
        resetRateLimit, // ✅ NEW: For testing only
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}
