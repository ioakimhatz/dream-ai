// app/contexts/ConversationContext.tsx - CONTINUOUS VOICE CONVERSATION with VAD
import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';
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

      // ✅ KEEP ORB IN THINKING STATE during GPT processing
      const response = await processConversationTurn(
        messages,
        transcript,
        extractedData || { rawTranscripts: [] },
        newTurnCount
      );

      // Update state
      setMessages(prev => [
        ...prev,
        { role: 'user', content: transcript },
        { role: 'assistant', content: response.question },
      ]);
      setExtractedData(response.extractedData);

      // Check if conversation is complete
      const isComplete = response.isComplete || newTurnCount >= MAX_TURNS;

      if (isComplete) {
        console.log('✅ Conversation complete!');
        setIsConversationComplete(true);
        setIsConversationActive(false);
        shouldAutoResumeRef.current = false;

        // Build final dream prompt
        const dreamPrompt = buildDreamPrompt(response.extractedData);
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
  }, [turnCount, messages, extractedData, onDreamPromptReady]);

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

  // Start conversation (called when user taps orb first time)
  const startConversation = useCallback(async () => {
    try {
      console.log('🎬 Starting continuous voice conversation...');

      setIsConversationActive(true);
      shouldAutoResumeRef.current = true;
      setCurrentMessage('I\'m listening...');

      await startRecordingInternal();
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Failed to start conversation. Please try again.');
      setOrbState('idle');
      setIsConversationActive(false);
    }
  }, [startRecordingInternal]);

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
    setTurnCount(0);
    setCurrentMessage(null);
    setIsConversationComplete(false);
  }, [stopConversation]);

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
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}
