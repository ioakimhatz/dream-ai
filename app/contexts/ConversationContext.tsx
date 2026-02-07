// app/contexts/ConversationContext.tsx - CONTINUOUS VOICE CONVERSATION with VAD
import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  processConversationTurn,
  ConversationMessage,
  ExtractedDreamData,
} from '../services/openaiConversationService';
import { speakText, stopSpeaking } from '../services/openaiTTSService';
import { transcribeAudio } from '../utils/transcribe';
import { getDoc, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebaseConfig';

/**
 * ORB CONVERSATION COST ANALYSIS
 *
 * Per conversation costs (approximate):
 * - Whisper API (audio transcription): $0.006 per minute
 *   Average conversation: 1.5 minutes = $0.009
 *
 * - GPT-4o API (conversation):
 *   Input: ~500 tokens @ $2.50/1M = $0.00125
 *   Output: ~200 tokens @ $10.00/1M = $0.002
 *   Total GPT: ~$0.003 per turn × 5 turns = $0.015
 *
 * - Total per conversation: ~$0.024 (2.4 cents)
 *
 * Promo code with 10 conversations: ~$0.24 cost
 * Unlimited for 30 days @ 3/day avg: ~$2.16 cost
 *
 * RECOMMENDATION: Use limited (10-20 conversations) for promo codes
 */

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface ConversationContextType {
  orbState: OrbState;
  currentMessage: string | null;
  isConversationActive: boolean;
  isConversationComplete: boolean;
  extractedData: ExtractedDreamData | null;
  messages: ConversationMessage[];
  turnCount: number;
  currentAudioLevel: number;  // ✅ NEW: Audio level for orb reactivity

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
  const [currentAudioLevel, setCurrentAudioLevel] = useState(0); // ✅ NEW: Audio level for orb reactivity

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
  // ✅ NEW: Track speech audio simulation
  const speechPulseTimerRef = useRef<NodeJS.Timeout | null>(null);
  // ✅ NEW: Track consecutive silent turns
  const consecutiveSilentTurnsRef = useRef(0);
  // ✅ FIX: Track isConversationActive in ref to avoid closure issues in TTS callbacks
  const isConversationActiveRef = useRef(false);
  // ✅ FIX: Track turnCount in ref for immediate updates (state has delay)
  const turnCountRef = useRef(0);

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

  // ✅ NEW: Simulate realistic speech audio pattern (syllables + pauses)
  const startSpeechAudioSimulation = useCallback(() => {
    let speechPulseCounter = 0;

    speechPulseTimerRef.current = setInterval(() => {
      // Realistic speech pattern with variation
      const syllablePulse = Math.random() * 0.7 + 0.3; // 0.3-1.0 random syllables
      const breathingWave = Math.sin(speechPulseCounter * 0.2) * 0.2 + 0.6; // 0.4-0.8 wave
      const finalLevel = (syllablePulse * 0.6) + (breathingWave * 0.4); // Blend random + wave

      setCurrentAudioLevel(Math.min(1, finalLevel));
      speechPulseCounter++;
    }, 80); // 80ms = responsive to orb physics
  }, []);

  // ✅ NEW: Stop speech audio simulation
  const stopSpeechAudioSimulation = useCallback(() => {
    if (speechPulseTimerRef.current) {
      clearInterval(speechPulseTimerRef.current);
      speechPulseTimerRef.current = null;
    }
    setCurrentAudioLevel(0);
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

      // ✅ FIX: Use ref to get latest extractedData (avoids state desync)
      console.log('🔍 DEBUG: extractedDataRef.current before processConversationTurn:', extractedDataRef.current.rawTranscripts);
      console.log('🔍 DEBUG: turnCountRef.current before processConversationTurn:', turnCountRef.current);

      // ✅ KEEP ORB IN THINKING STATE during GPT processing
      const response = await processConversationTurn(
        messages,
        transcript,
        extractedDataRef.current, // ✅ FIX: Use ref instead of state
        turnCountRef.current  // ✅ FIX: Use ref for immediate current value (not stale state)
      );

      // ✅ FIX: Use turnCount from response and update BOTH state and ref
      const newTurnCount = response.turnCount;
      setTurnCount(newTurnCount);  // For UI display
      turnCountRef.current = newTurnCount;  // ✅ For immediate use in next call
      console.log('🔍 DEBUG: Updated turnCount to:', newTurnCount);

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

      console.log('🔍 DEBUG COMPLETION CHECK IN PROCESSTURN:');
      console.log('  - response.isComplete:', response.isComplete);
      console.log('  - newTurnCount:', newTurnCount);
      console.log('  - MAX_TURNS:', MAX_TURNS);
      console.log('  - isComplete:', isComplete);
      console.log('  - response.question:', response.question);

      if (isComplete) {
        console.log('✅ Conversation marked as COMPLETE!');
        console.log('🔍 WHY: response.isComplete =', response.isComplete, ', turnCount =', newTurnCount);
        setIsConversationComplete(true);
        setIsConversationActive(false);
        isConversationActiveRef.current = false; // ✅ Sync ref
        shouldAutoResumeRef.current = false;

        // ✅ FIX: Don't build dream prompt here - let index.tsx useEffect handle it
        // This avoids duplicate GPT calls

        // Speak completion message
        setOrbState('thinking'); // ✅ Start in thinking while TTS generates

        // ✅ Use onStart/onComplete callbacks
        const sound = await speakText(
          'Great! I have everything I need.',
          // onComplete
          () => {
            // This runs when TTS actually finishes playing
            console.log('🔊 Completion message finished, transitioning to idle...');
            stopSpeechAudioSimulation(); // ✅ Stop speech audio pattern
            setOrbState('idle');
            setCurrentMessage(null);
          },
          // onStart - ✅ Show text when audio starts
          () => {
            setOrbState('speaking');
            setCurrentMessage('Great! I have everything I need.');
            startSpeechAudioSimulation(); // ✅ Start speech audio pattern
          }
        );

        soundRef.current = sound;

        return;
      }

      // Speak AI's question
      // ✅ FIX: Keep orb in thinking state while TTS generates
      // Text won't show until audio ACTUALLY starts playing
      setOrbState('thinking');

      // ✅ FIX: Start TTS in parallel (don't await until we need to)
      shouldAutoResumeRef.current = true;
      const speakPromise = speakText(
        response.question,
        // onComplete callback - runs when TTS finishes playing
        () => {
          console.log('🔊 TTS playback completed, checking if should auto-resume...');
          console.log('🔍 shouldAutoResumeRef.current:', shouldAutoResumeRef.current);
          console.log('🔍 isConversationActiveRef.current:', isConversationActiveRef.current);

          stopSpeechAudioSimulation(); // ✅ Stop speech audio pattern

          // ✅ CRITICAL: Use REF not state to avoid closure issues
          if (shouldAutoResumeRef.current && isConversationActiveRef.current) {
            console.log('✅ Auto-resuming recording for next turn...');

            // ✅ IMMEDIATELY show listening state for instant perceived feedback
            // User sees the visual change right away, even if recording takes a moment to init
            setOrbState('listening');
            setCurrentMessage('I\'m listening...');

            // Then start actual recording (may take 100-200ms to initialize)
            // Visual feedback is already shown, so user can start speaking immediately
            startRecordingInternal();
          } else {
            console.log('⛔ Auto-resume blocked');
            console.log('  - shouldAutoResume:', shouldAutoResumeRef.current);
            console.log('  - isConversationActive:', isConversationActiveRef.current);
          }
        },
        // onStart callback - ✅ NEW: runs when audio STARTS playing
        () => {
          console.log('🔊 Audio started playing - showing text now');
          setOrbState('speaking');
          setCurrentMessage(response.question);
          startSpeechAudioSimulation(); // ✅ Start realistic speech audio pattern
        }
      );

      const sound = await speakPromise;
      soundRef.current = sound;
    } catch (error) {
      console.error('❌ Error processing turn:', error);
      Alert.alert('Error', 'Failed to process your message. Please try again.');
      setOrbState('idle');
      setIsConversationActive(false);
      isConversationActiveRef.current = false; // ✅ Sync ref
      shouldAutoResumeRef.current = false;
    }
  }, [turnCount, messages, onDreamPromptReady, startSpeechAudioSimulation, stopSpeechAudioSimulation]); // ✅ FIX: Removed extractedData from deps since we use ref now

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

            // ✅ NEW: Update audio level for orb animation
            // Normalize -35dB to 0dB range to 0-1 scale
            const normalizedLevel = Math.min(1, Math.max(0, (audioLevel + 35) / 35));
            setCurrentAudioLevel(normalizedLevel);

            // ✅ NEW: First speech detected - clear the "no speech" timeout
            if (!hasDetectedSpeechRef.current) {
              hasDetectedSpeechRef.current = true;

              // Reset silent turn counter - user is responding!
              consecutiveSilentTurnsRef.current = 0;

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
        console.log('⏱️ No speech detected after 5 seconds...');

        // Increment silent turn counter
        consecutiveSilentTurnsRef.current++;
        console.log(`🔇 Silent turns: ${consecutiveSilentTurnsRef.current}/3`);

        // Stop recording
        stopRecordingInternal().then(() => {
          // If this is the 3rd silent turn, close conversation
          if (consecutiveSilentTurnsRef.current >= 3) {
            console.log('⛔ Too many silent turns, closing conversation...');

            setOrbState('idle');
            setCurrentMessage(null);
            setIsConversationActive(false);
            isConversationActiveRef.current = false; // ✅ Sync ref
            shouldAutoResumeRef.current = false;

            Alert.alert(
              'Conversation Ended',
              "You stopped responding. Tap the orb when you're ready to describe your dream!",
              [{ text: 'OK' }]
            );
          } else {
            // Try one more time with encouragement
            setOrbState('thinking'); // ✅ Start in thinking while TTS generates
            const encouragement = consecutiveSilentTurnsRef.current === 1
              ? "I'm still here! Tell me about your dream."
              : "Last chance - what did you dream about?";

            speakText(
              encouragement,
              // onComplete
              () => {
                stopSpeechAudioSimulation(); // ✅ Stop speech audio pattern

                if (shouldAutoResumeRef.current) {
                  setOrbState('listening');
                  setCurrentMessage("I'm listening...");
                  startRecordingInternal();
                }
              },
              // onStart - ✅ Show text when audio starts
              () => {
                setOrbState('speaking');
                setCurrentMessage(encouragement);
                startSpeechAudioSimulation(); // ✅ Start speech audio pattern
              }
            );
          }
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

  // Check if user can start a new conversation (rate limiting + promo codes)
  const canStartConversation = useCallback(async (): Promise<boolean> => {
    try {
      // Check if user has promo code conversation credits
      if (auth.currentUser) {
        const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
        const userData = userDoc.data();

        // Check promo code benefits
        if (userData?.promoConversationsRemaining && userData.promoConversationsRemaining > 0) {
          // Check if promo expired
          if (userData.promoCodeExpiry) {
            const expiryDate = userData.promoCodeExpiry.toDate();
            if (expiryDate > new Date()) {
              console.log(`✅ Promo: ${userData.promoConversationsRemaining} conversations remaining`);
              return true; // Allow conversation (will be decremented after completion)
            } else {
              // Expired - remove benefit silently
              console.log('⏰ Promo expired, removing benefits');
              await setDoc(doc(db, 'users', auth.currentUser.uid), {
                promoConversationsRemaining: 0,
              }, { merge: true });
            }
          } else {
            // No expiry date set - allow
            console.log(`✅ Promo: ${userData.promoConversationsRemaining} conversations remaining`);
            return true;
          }
        }
      }

      // Regular rate limit check for non-promo users
      const lastConversationTime = await AsyncStorage.getItem(STORAGE_KEY_LAST_CONVERSATION);

      if (!lastConversationTime) {
        return true;
      }

      const lastTime = parseInt(lastConversationTime, 10);
      const now = Date.now();
      const hoursSinceLastConversation = (now - lastTime) / (1000 * 60 * 60);

      if (hoursSinceLastConversation < CONVERSATION_COOLDOWN_HOURS) {
        const tomorrowReset = new Date(lastTime);
        tomorrowReset.setHours(new Date(lastTime).getHours() + 24, 0, 0, 0);

        const msUntilReset = tomorrowReset.getTime() - now;
        const hoursUntilReset = Math.floor(msUntilReset / (1000 * 60 * 60));
        const minutesUntilReset = Math.ceil((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));

        const resetMessage = hoursUntilReset > 0
          ? `Come back in ${hoursUntilReset}h ${minutesUntilReset}m`
          : `Come back in ${minutesUntilReset} minutes`;

        Alert.alert(
          '✨ Daily Free Conversation Used',
          `${resetMessage} for your next free orb conversation!\n\n💡 Tip: You can still type your dream using the text input below.`,
          [{ text: 'Got it' }]
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error checking conversation availability:', error);
      return false;
    }
  }, []);

  // Force conversation completion when time limit reached
  const forceConversationCompletion = useCallback(async () => {
    console.log('⏰ Forcing conversation completion due to time limit...');

    // ✅ CRITICAL: Set shouldAutoResumeRef to false FIRST to prevent race condition
    // This ensures any pending TTS callbacks from processTurn won't restart recording
    shouldAutoResumeRef.current = false;

    // ✅ GUARD: Use ref to check if already completed (avoids closure issues)
    if (!isConversationActiveRef.current) {
      console.log('⚠️ Force completion called but conversation not active - ignoring');
      return;
    }

    console.log('✅ Force completion proceeding - conversation is active');

    // ✅ Immediately mark as inactive to prevent re-entry
    setIsConversationActive(false);
    isConversationActiveRef.current = false; // ✅ Sync ref

    // Stop any active recording
    if (recordingRef.current) {
      await stopRecordingInternal();
    }

    // Stop any active speech to prevent conflicts
    if (soundRef.current) {
      stopSpeaking(soundRef.current);
      soundRef.current = null;
    }

    // ✅ FIX: Don't build dream prompt here - let index.tsx useEffect handle it
    // This avoids duplicate GPT calls

    // Set as complete
    setIsConversationComplete(true);
    setIsConversationActive(false);
    isConversationActiveRef.current = false; // ✅ Sync ref

    // Speak completion message
    setOrbState('thinking'); // ✅ Start in thinking while TTS generates

    // ✅ Use onStart/onComplete callbacks
    const sound = await speakText(
      'Time\'s up! Let me create your dream with what you\'ve told me.',
      // onComplete
      () => {
        // This runs when TTS actually finishes playing
        console.log('🔊 Time limit completion message finished');
        stopSpeechAudioSimulation(); // ✅ Stop speech audio pattern
        setOrbState('idle');
        setCurrentMessage(null);
      },
      // onStart - ✅ Show text when audio starts
      () => {
        setOrbState('speaking');
        setCurrentMessage('Time\'s up! Let me create your dream with what you\'ve told me.');
        startSpeechAudioSimulation(); // ✅ Start speech audio pattern
      }
    );

    soundRef.current = sound;
  }, [isConversationActive, onDreamPromptReady, stopRecordingInternal, startSpeechAudioSimulation, stopSpeechAudioSimulation]); // ✅ FIX: Removed extractedData from deps since we use ref now

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

      // ✅ Reset silent turn counter
      consecutiveSilentTurnsRef.current = 0;

      setIsConversationActive(true);
      isConversationActiveRef.current = true; // ✅ Sync ref
      shouldAutoResumeRef.current = true;
      setCurrentMessage('I\'m listening...');

      // ✅ NEW: Save conversation start time for rate limiting
      try {
        await AsyncStorage.setItem(STORAGE_KEY_LAST_CONVERSATION, Date.now().toString());
        console.log('✅ Conversation timestamp saved for rate limiting');
      } catch (error) {
        console.error('❌ Error saving conversation timestamp:', error);
      }

      // Decrement promo conversation count if user has promo
      if (auth.currentUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
          const userData = userDoc.data();

          if (userData?.promoConversationsRemaining && userData.promoConversationsRemaining > 0) {
            const newCount = userData.promoConversationsRemaining - 1;
            await setDoc(doc(db, 'users', auth.currentUser.uid), {
              promoConversationsRemaining: newCount,
            }, { merge: true });

            console.log(`✅ Promo conversation used. ${newCount} remaining.`);

            // Show user their remaining count
            if (newCount === 0) {
              Alert.alert(
                '🎉 Promo Conversations Complete',
                'You\'ve used all your promo conversations! Tomorrow you\'ll get your daily free conversation back.',
                [{ text: 'Got it' }]
              );
            } else if (newCount <= 3) {
              // Warn when running low
              Alert.alert(
                `✨ ${newCount} Promo Conversations Left`,
                'Use them wisely!',
                [{ text: 'OK' }]
              );
            }
          }
        } catch (error) {
          console.error('Error decrementing promo conversations:', error);
        }
      }

      // ✅ NEW: Start overall conversation duration timer
      conversationDurationRef.current = 0;
      conversationTimerRef.current = setInterval(() => {
        conversationDurationRef.current += 1;
        console.log(`⏱️ Conversation duration: ${conversationDurationRef.current}s / ${MAX_CONVERSATION_DURATION}s`);

        // Check if max duration reached
        if (conversationDurationRef.current >= MAX_CONVERSATION_DURATION) {
          console.log('⏱️ Max conversation duration (1.5 minutes) reached, forcing completion...');

          // ✅ CRITICAL: Clear timer FIRST to prevent multiple triggers
          if (conversationTimerRef.current) {
            clearInterval(conversationTimerRef.current);
            conversationTimerRef.current = null;
          }

          // ✅ Reset duration to prevent re-trigger
          conversationDurationRef.current = 0;

          // Force conversation completion (now safe - can only happen once)
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
      isConversationActiveRef.current = false; // ✅ Sync ref
    }
  }, [startRecordingInternal, forceConversationCompletion, canStartConversation]);

  // Stop conversation (user can tap orb during conversation to stop)
  const stopConversation = useCallback(async () => {
    console.log('🛑 User stopped conversation - completing with current data...');

    stopSpeechAudioSimulation();
    shouldAutoResumeRef.current = false;

    // Stop recording if active
    if (recordingRef.current) {
      await stopRecordingInternal();
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

    if (conversationTimerRef.current) {
      clearInterval(conversationTimerRef.current);
      conversationTimerRef.current = null;
    }
    conversationDurationRef.current = 0;

    // ✅ NEW: Complete conversation if we have data
    if (extractedDataRef.current.rawTranscripts && extractedDataRef.current.rawTranscripts.length > 0) {
      // ✅ FIX: Don't build dream prompt here - let index.tsx useEffect handle it
      // This avoids duplicate GPT calls

      setIsConversationComplete(true);

      // Speak quick confirmation
      setOrbState('speaking');
      setCurrentMessage('Got it! Let me create that for you.');

      const sound = await speakText(
        'Got it! Let me create that for you.',
        () => {
          stopSpeechAudioSimulation();
          setOrbState('idle');
          setCurrentMessage(null);
        },
        () => {
          setOrbState('speaking');
          setCurrentMessage('Got it! Let me create that for you.');
          startSpeechAudioSimulation();
        }
      );

      soundRef.current = sound;
    } else {
      // No data collected yet - just stop
      setOrbState('idle');
      setIsConversationActive(false);
      isConversationActiveRef.current = false; // ✅ Sync ref
      setCurrentMessage(null);
    }
  }, [stopRecordingInternal, stopSpeechAudioSimulation, startSpeechAudioSimulation, onDreamPromptReady]);

  // Reset conversation
  const resetConversation = useCallback(() => {
    console.log('🔄 Resetting conversation...');

    stopConversation();

    setMessages([]);
    setExtractedData(null);
    extractedDataRef.current = { rawTranscripts: [] }; // ✅ FIX: Reset ref too
    setTurnCount(0);
    turnCountRef.current = 0;  // ✅ FIX: Reset turnCount ref too
    setCurrentMessage(null);
    setIsConversationComplete(false);

    // ✅ NEW: Ensure conversation duration is reset
    conversationDurationRef.current = 0;
    consecutiveSilentTurnsRef.current = 0; // ✅ Reset silent turns
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
        currentAudioLevel,  // ✅ NEW: For audio-reactive orb
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
