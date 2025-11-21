// app/(tabs)/index.tsx - FIXED: Loading screen issue
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { Audio, ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../contexts/AuthContext';
import { useDreamUsage } from '../contexts/DreamUsageContext';
import { useLanguage } from '../contexts/LanguageContext';
import { removeBackground } from '../utils/backgroundRemoval';
import { analyzePromptStrength } from '../utils/promptValidator';
import { saveDream } from '../utils/storage';
import { transcribeAudio } from '../utils/transcribe';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';
import {
  registerForPushNotifications,
  sendVideoReadyNotification,
  sendVideoFailedNotification,
  saveFCMToken,
} from '../utils/notificationService';
import { syncDreamsFromFirestore } from '../services/syncService';

import { SubscriptionModal } from '@/components/SubscriptionModal';
import { BlurredDreamPreview } from '@/components/BlurredDreamPreview';

interface PromptAnalysis {
  strength: 'WEAK' | 'FAIR' | 'GOOD' | 'EXCELLENT';
  score: number;
  issues: string[];
  suggestions: string[];
  canGenerate: boolean;
  hasAdultContent?: boolean;
}

const DREAM_PURPLE = '#7278E6';
const MAX_IMAGES = 3;

function getStrengthColor(a: PromptAnalysis): string {
  switch (a.strength) {
    case 'WEAK': return '#ff4444';
    case 'FAIR': return '#ff9500';
    case 'GOOD': return '#00aa00';
    case 'EXCELLENT': return '#7278E6';
    default: return '#999999';
  }
}

function getStrengthMessage(a: PromptAnalysis): string {
  switch (a.strength) {
    case 'WEAK': return 'Add more details for better results';
    case 'FAIR': return 'Good start - add one more detail';
    case 'GOOD': return 'Great prompt - ready to generate!';
    case 'EXCELLENT': return 'Perfect! Cinema-quality incoming!';
    default: return '';
  }
}

const PromptStrengthIndicator = ({ prompt, onAnalysisChange, userLanguage }: {
  prompt: string;
  onAnalysisChange?: (a: PromptAnalysis) => void;
  userLanguage: string;
}) => {
  const analysis = React.useMemo(() => {
    if (!prompt.trim()) {
      return {
        strength: 'WEAK' as const,
        score: 0,
        issues: ['Start typing your dream...'],
        suggestions: ['Describe who, what, where, and how you felt'],
        canGenerate: false,
        hasAdultContent: false
      };
    }
    return analyzePromptStrength(prompt, userLanguage);
  }, [prompt, userLanguage]);

  React.useEffect(() => { onAnalysisChange?.(analysis); }, [analysis, onAnalysisChange]);

  if (!prompt.trim()) {
    return (
      <View style={strengthStyles.container}>
        <Text style={strengthStyles.emptyMessage}>Start describing your dream to see strength analysis...</Text>
      </View>
    );
  }

  return (
    <View style={strengthStyles.container}>
      <View style={strengthStyles.progressContainer}>
        <View style={strengthStyles.progressBackground}>
          <View style={[strengthStyles.progressFill, { width: `${analysis.score}%`, backgroundColor: getStrengthColor(analysis) }]} />
        </View>
        <Text style={strengthStyles.scoreText}>{analysis.score}/100</Text>
      </View>
      <Text style={[strengthStyles.strengthText, { color: getStrengthColor(analysis) }]}>
        {getStrengthMessage(analysis)}
      </Text>

      {analysis.hasAdultContent && (
        <View style={strengthStyles.comingSoonContainer}>
          <Text style={strengthStyles.comingSoonIcon}>🔞</Text>
          <View style={strengthStyles.comingSoonTextContainer}>
            <Text style={strengthStyles.comingSoonTitle}>18+ Content Coming Soon!</Text>
            <Text style={strengthStyles.comingSoonText}>
              This type of content is not currently available, but we're working on it!
            </Text>
            <Text style={strengthStyles.comingSoonHint}>
              🔔 Stay tuned for future updates with expanded content options!
            </Text>
          </View>
        </View>
      )}

      {analysis.issues.length > 0 && !analysis.hasAdultContent && (
        <View style={strengthStyles.feedbackContainer}>
          {analysis.issues.map((issue, i) => (<Text key={i} style={strengthStyles.issueText}>• {issue}</Text>))}
        </View>
      )}
      {analysis.suggestions.length > 0 && !analysis.hasAdultContent && (
        <View style={strengthStyles.feedbackContainer}>
          <Text style={strengthStyles.suggestionsTitle}>Suggestions:</Text>
          {analysis.suggestions.slice(0, 2).map((s, i) => (<Text key={i} style={strengthStyles.suggestionText}>• {s}</Text>))}
        </View>
      )}
    </View>
  );
};

export default function HomeScreen() {
  const { language } = useLanguage();

  useEffect(() => {
    const fix = () => {
      if (Platform.OS === 'android') {
        RNStatusBar.setBackgroundColor('transparent', true);
        RNStatusBar.setTranslucent(true);
        RNStatusBar.setBarStyle('light-content', true);
      }
    };
    fix();
    const t = setTimeout(fix, 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const requestMicPermission = async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Microphone Access Required',
            'Dream AI needs microphone access to record your dreams. Please enable it in Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                }
              }
            ]
          );
        }
      } catch (error) {
        console.error('Error requesting mic permission:', error);
      }
    };

    requestMicPermission();
  }, []);

  const { user } = useAuth();

  useEffect(() => {
    const setupNotifications = async () => {
      try {
        const token = await registerForPushNotifications();

        if (token && user) {
          await saveFCMToken(user.id, token);
          console.log('✅ FCM token saved for user:', user.id);
        }

        console.log('✅ Notifications configured');
      } catch (error) {
        console.error('Failed to setup notifications:', error);
      }
    };

    const syncOnMount = async () => {
      try {
        // 🔥 CRITICAL: Sync dreams on mount to catch any videos that completed while app was closed
        console.log('🔄 [index.tsx] Syncing dreams on mount...');
        await syncDreamsFromFirestore(user.id);
      } catch (error) {
        console.error('Failed to sync dreams on mount:', error);
      }
    };

    if (user) {
      setupNotifications();
      syncOnMount();
    }
  }, [user]);

  const {
    dreamUsage,
    subscription,
    offerings,
    purchaseSubscription,
    restorePurchases,
  } = useDreamUsage();

  const [showPaywall, setShowPaywall] = useState(false);
  const [showBlurredPreview, setShowBlurredPreview] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [transcript, setTranscript] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const generationLockRef = useRef(false);

  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [processedImages, setProcessedImages] = useState<Map<string, boolean>>(new Map());
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const [finalVideoUri, setFinalVideoUri] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVideoLoading, setIsVideoLoading] = useState(false);

  const [promptAnalysis, setPromptAnalysis] = useState<PromptAnalysis | null>(null);

  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStep, setGenerationStep] = useState('');
  const [videoKey, setVideoKey] = useState(0);
  const [isFocused, setIsFocused] = useState(true);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [completedDreamId, setCompletedDreamId] = useState<string | null>(null);

  const waveAnimations = useRef([
    new Animated.Value(0.3),
    new Animated.Value(0.5),
    new Animated.Value(0.8),
    new Animated.Value(0.4),
    new Animated.Value(0.6),
  ]).current;

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const saved = await AsyncStorage.getItem('language');
          if (saved) {
            console.log('🌍 Loading language:', saved);
            setCurrentLanguage(saved);
          }
        } catch (e) {
          console.error('Failed to load language:', e);
        }
      })();
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => {
        setIsFocused(false);
      };
    }, [])
  );

  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        console.log('✅ Audio session initialized');
      } catch (e) {
        console.error('Failed to initialize audio session:', e);
      }
    })();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (recording) {
          console.log('📱 App went to background, stopping recording...');
          stopRecording();
        }
      } else if (nextAppState === 'active') {
        console.log('📱 App came to foreground, syncing dreams...');

        // 🔥 CRITICAL: Sync dreams when app comes to foreground
        // This catches any videos that completed while app was in background
        if (user) {
          try {
            await syncDreamsFromFirestore(user.id);
          } catch (error) {
            console.error('Failed to sync dreams on foreground:', error);
          }
        }

        console.log('📱 Checking for active generation jobs...');

        if (activeJobId && isGenerating) {
          console.log(`🔍 Checking status of job ${activeJobId}...`);

          try {
            const { getDreamJob } = await import('../services/firestoreService');
            const job = await getDreamJob(activeJobId);

            if (job && job.status === 'completed' && job.videoUrl) {
              console.log('✅ Job completed while app was in background!');

              setGenerationStep('Finalizing video...');
              setGenerationProgress(95);

              console.log('⏰ Waiting 20 seconds for Cloudinary splice to process...');
              await new Promise(resolve => setTimeout(resolve, 20000));

              console.log('✅ Video should be ready now, preparing to display...');
              setGenerationStep('Loading video...');
              setGenerationProgress(98);

              setFinalVideoUri(job.videoUrl);
              setCoverImage(job.thumbnailUrl ?? null);
              setVideoKey(prev => prev + 1);
              setActiveJobId(null);

              // 🔥 Use job.id instead of generating new UUID to prevent duplicates
              setCompletedDreamId(job.id);
              saveDream({
                id: job.id,
                createdAt: Date.now(),
                prompt: transcript,
                thumbnailUrl: job.thumbnailUrl ?? null,
                videoUrl: job.videoUrl,
                clips: undefined,
                duration: 15,
              });

              sendVideoReadyNotification(job.videoUrl, job.id);
              Alert.alert('Dream Created!', 'Your dream cinema is ready!');
            } else if (job && job.status === 'failed') {
              console.error('❌ Job failed while app was in background');
              setIsGenerating(false);
              setActiveJobId(null);

              // ✅ Backend automatically refunds via Cloud Function (processDreamJob.ts)
              // ✅ Real-time listener will show updated count immediately
              // No need for frontend refund (would cause double refund)

              Alert.alert(
                'Generation Failed - Dream Restored',
                job.error || 'Your dream has been restored. Please try again.',
                [{ text: 'OK' }]
              );

              sendVideoFailedNotification(job.id);
            }
          } catch (error) {
            console.error('❌ Failed to check job status:', error);
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [recording, activeJobId, isGenerating, transcript, user]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (recording) {
      const animations = waveAnimations.map((anim) =>
        Animated.loop(Animated.sequence([
          Animated.timing(anim, { toValue: Math.random() * 0.8 + 0.2, duration: 300 + Math.random() * 200, useNativeDriver: false }),
          Animated.timing(anim, { toValue: Math.random() * 0.8 + 0.2, duration: 300 + Math.random() * 200, useNativeDriver: false }),
        ]))
      );
      animations.forEach(a => a.start());
      return () => { animations.forEach(a => a.stop()); };
    } else {
      waveAnimations.forEach(a => a.setValue(0.3));
    }
  }, [recording, waveAnimations]);

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow microphone access to record your dreams.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setRecordingDuration(0);

      const MAX_RECORDING_DURATION = 180;
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          const newDuration = prev + 1;
          if (newDuration >= MAX_RECORDING_DURATION) {
            console.log('⏰ Max recording duration reached (3 minutes), auto-stopping...');
            stopRecording();
            return prev;
          }
          return newDuration;
        });
      }, 1000);
    } catch (e) {
      console.error('Failed to start recording', e);
      Alert.alert('Recording Error', 'Could not start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setIsTranscribing(true);
    setRecording(null);
    setRecordingDuration(0);

    try {
      await recording.stopAndUnloadAsync();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const uri = recording.getURI();
      if (!uri) {
        Alert.alert('Error', 'Failed to save recording');
        setIsTranscribing(false);
        return;
      }

      const languageToUse = language || currentLanguage || 'en';
      console.log('🎤 Transcribing with language:', languageToUse);

      const result = await transcribeAudio(uri, languageToUse);
      setTranscript(result);
    } catch (e) {
      console.error('Failed to transcribe audio:', e);
      Alert.alert('Transcription Error', 'Could not transcribe your recording. Please try typing instead.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const pickImage = async () => {
    if (selectedImages.length >= MAX_IMAGES) {
      Alert.alert(
        '🎬 Multi-Character Dreams Coming Soon!',
        `Currently limited to ${MAX_IMAGES} people per dream.\n\n✨ Stay tuned for updates with support for larger casts!`,
        [{ text: 'Got it!', style: 'default' }]
      );
      return;
    }

    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow access to your photo library to add people to your dreams.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images' as any,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const originalImage = result.assets[0].uri;
        setIsProcessingImage(true);
        try {
          const processed = await removeBackground(originalImage, { size: 'preview', type: 'person' });
          setSelectedImages(prev => [...prev, processed]);
          const map = new Map(processedImages);
          map.set(processed, processed !== originalImage);
          setProcessedImages(map);
          if (processed !== originalImage) {
            Alert.alert('Background Removed!', 'Your face will blend naturally into the dream video.', [{ text: 'Great!', style: 'default' }]);
          }
        } catch (err) {
          console.error('Error processing image:', err);
          setSelectedImages(prev => [...prev, originalImage]);
        } finally {
          setIsProcessingImage(false);
        }
      }
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('Error', 'Failed to select image. Please try again.');
      setIsProcessingImage(false);
    }
  };

  const removeImage = (i: number) => setSelectedImages(prev => prev.filter((_, idx) => idx !== i));

  const proceedWithGeneration = useCallback(async () => {
    if (generationLockRef.current) {
      console.log('⚠️ Generation locked, preventing duplicate API call');
      return;
    }

    try {
      if (!transcript || !user) return;

      generationLockRef.current = true;

      setIsGenerating(true);
      setFinalVideoUri(null);
      setCoverImage(null);
      setGenerationProgress(0);
      setGenerationStep('Preparing your dream...');

      let cloudinaryImageUrls: string[] = [];

      if (selectedImages.length > 0) {
        setGenerationStep('Uploading face images...');
        setGenerationProgress(3);

        console.log(`📤 Uploading ${selectedImages.length} face image(s) to Cloudinary...`);

        const { uploadImageToCloudinary } = await import('../utils/cloudinaryUpload');

        try {
          cloudinaryImageUrls = await Promise.all(
            selectedImages.map(async (uri, index) => {
              console.log(`📤 Uploading image ${index + 1}/${selectedImages.length}...`);
              const cloudinaryUrl = await uploadImageToCloudinary(uri);
              console.log(`✅ Image ${index + 1} uploaded: ${cloudinaryUrl}`);
              return cloudinaryUrl;
            })
          );

          console.log('✅ All face images uploaded to Cloudinary:', cloudinaryImageUrls);
        } catch (uploadError: any) {
          console.error('❌ Failed to upload face images:', uploadError);
          throw new Error('Failed to upload face images. Please try again.');
        }
      } else {
        console.log('ℹ️ No face images to upload - generating from prompt only');
      }

      setGenerationStep('Creating your dream job...');
      setGenerationProgress(5);

      const { createDreamJob, subscribeToJob } = await import('../services/firestoreService');

      const jobId = await createDreamJob({
        userId: user.id,
        prompt: transcript,
        selectedImages: cloudinaryImageUrls.length > 0 ? cloudinaryImageUrls : undefined,
        settings: {
          model: 'kling',
          duration: 15,
          aspectRatio: '16:9',
          scenes: 3,
        },
      });

      console.log('✅ Dream job created:', jobId);
      setActiveJobId(jobId);
      setGenerationStep('Job created! Processing on server...');

      const unsubscribe = subscribeToJob(
        jobId,
        async (job) => {
          console.log('🔄 Job update:', job.status, job.progress);

          setGenerationProgress(job.progress);
          setGenerationStep(job.currentStep || `Status: ${job.status}`);

          if (job.status === 'completed' && job.videoUrl) {
            console.log('✅ Job completed!');
            console.log('🎬 Video URL:', job.videoUrl);

            setGenerationStep('Finalizing video...');
            setGenerationProgress(95);

            console.log('⏰ Waiting 20 seconds for Cloudinary splice to process...');
            await new Promise(resolve => setTimeout(resolve, 20000));

            console.log('✅ Video should be ready now, preparing to display...');
            setGenerationStep('Loading video...');
            setGenerationProgress(98);

            setFinalVideoUri(job.videoUrl);
            setCoverImage(job.thumbnailUrl ?? null);
            setVideoKey(prev => prev + 1);

            // 🔥 Use job.id instead of generating new UUID to prevent duplicates
            setCompletedDreamId(job.id);
            saveDream({
              id: job.id,
              createdAt: Date.now(),
              prompt: transcript,
              thumbnailUrl: job.thumbnailUrl ?? null,
              videoUrl: job.videoUrl,
              clips: undefined,
              duration: 15,
            });

            sendVideoReadyNotification(job.videoUrl, job.id);
            Alert.alert('Dream Created!', 'Your dream cinema is ready!');

            setActiveJobId(null);
            unsubscribe();
            generationLockRef.current = false;
          }

          if (job.status === 'failed') {
            console.error('❌ Job failed:', job.error);
            setIsGenerating(false);

            // ✅ Backend automatically refunds via Cloud Function (processDreamJob.ts)
            // ✅ Real-time listener will show updated count immediately
            // No need for frontend refund (would cause double refund)

            Alert.alert(
              'Generation Failed - Dream Restored',
              job.error || 'Your dream has been restored. Please try again.',
              [{ text: 'OK' }]
            );

            sendVideoFailedNotification(job.id);

            setActiveJobId(null);
            unsubscribe();
            generationLockRef.current = false;
          }
        },
        (error) => {
          console.error('❌ Subscription error:', error);
          setIsGenerating(false);
          Alert.alert('Error', 'Lost connection to server. Please try again.');
          generationLockRef.current = false;
        }
      );

      setTimeout(() => {
        if (generationLockRef.current) {
          console.log('⏰ Generation timeout, cleaning up...');
          unsubscribe();
          setIsGenerating(false);
          generationLockRef.current = false;
          Alert.alert('Timeout', 'Generation is taking too long. Please try again.');
        }
      }, 10 * 60 * 1000);

    } catch (err: any) {
      console.error('❌ Error creating dream job:', err);

      setIsGenerating(false);
      setGenerationProgress(0);
      setGenerationStep('');
      generationLockRef.current = false;

      Alert.alert(
        'Error',
        err.message || 'Failed to create dream job. Please try again.',
        [{ text: 'OK' }]
      );
    }
  }, [transcript, user, selectedImages]);

  const handleGenerateDream = async () => {
    if (isGenerating) {
      console.log('⚠️ Generation already in progress, ignoring duplicate call');
      return;
    }

    if (promptAnalysis?.hasAdultContent) {
      Alert.alert(
        '🔞 18+ Content Coming Soon!',
        'This type of content is not currently available, but we\'re working on it!\n\n🔔 Stay tuned for future updates with expanded content options!'
      );
      return;
    }

    if (!promptAnalysis?.canGenerate) {
      Alert.alert(
        'Dream Needs More Details',
        `Your dream description needs to be richer for premium quality results. Current strength: ${promptAnalysis?.strength}\n\nSuggestions:\n${promptAnalysis?.suggestions?.slice(0, 2).join('\n') || 'Add more details about emotions, setting, and actions'}`
      );
      return;
    }
    if (!transcript) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (!subscription) {
      setIsGenerating(true);
      setGenerationProgress(0);
      setGenerationStep('Analyzing your dream…');
      const iv = setInterval(() => setGenerationProgress(prev => Math.min(prev + 25, 100)), 1000);
      setTimeout(() => setGenerationStep('Creating scenes…'), 1000);
      setTimeout(() => setGenerationStep('Almost ready…'), 2500);
      setTimeout(() => {
        clearInterval(iv);
        setIsGenerating(false);
        setGenerationProgress(0);
        setGenerationStep('');
        setShowBlurredPreview(true);
      }, 4000);
      return;
    }

    // 🔥 NEW: Check if user has dreams available (read from Firestore - server is source of truth)
    // NOTE: We don't deduct here anymore - Cloud Function will handle deduction
    try {
      if (!user) {
        Alert.alert('Error', 'Please sign in to generate dreams');
        return;
      }

      console.log('🔍 Checking dream availability from Firestore...');
      const usageRef = doc(db, 'dreamUsage', user.id);
      const usageSnap = await getDoc(usageRef);

      if (!usageSnap.exists()) {
        Alert.alert('Error', 'Unable to verify dream availability. Please try again.');
        return;
      }

      const usageData = usageSnap.data();
      const used = usageData.used || 0;
      const total = usageData.total || 0;

      console.log(`📊 Dream availability check: ${used}/${total}`);

      if (used >= total) {
        Alert.alert(
          'Dream Limit Reached',
          `You've used all ${total} dreams for this period. Next reset: ${new Date(usageData.resetDate?.toDate?.() || usageData.resetDate).toLocaleDateString()}`,
          [{ text: 'OK', style: 'cancel' }]
        );
        return;
      }

      console.log('✅ User has dreams available - proceeding to generation');
      console.log('ℹ️ Server will deduct dream when job starts');

      // Proceed with generation - Cloud Function will deduct the dream
      await proceedWithGeneration();

    } catch (error) {
      console.error('❌ Error checking dream availability:', error);
      Alert.alert('Error', 'Unable to verify dream availability. Please try again.');
    }
  };

  const handleSelectPlan = async (planType: 'weekly' | 'basic' | 'pro') => {
    if (isPurchasing) {
      console.log('⚠️ Purchase already in progress, ignoring tap');
      return;
    }

    const productMap: Record<string, string> = {
      weekly: 'dream_weekly',
      basic: 'dream_basic_monthly',
      pro: 'dream_pro_monthly'
    };

    const productId = productMap[planType];

    if (!offerings?.availablePackages) {
      Alert.alert('Error', 'Subscription plans are not available. Please try again later.');
      return;
    }

    console.log('💳 Looking for product ID:', productId);

    const packageToPurchase = offerings.availablePackages.find(
      (p) => p.product.identifier === productId
    );

    if (!packageToPurchase) {
      Alert.alert('Error', 'Selected plan is not available. Please try again.');
      return;
    }

    console.log('✅ Found package:', packageToPurchase.identifier);

    setIsPurchasing(true);

    try {
      const success = await purchaseSubscription(packageToPurchase);

      if (success) {
        setShowPaywall(false);
        setShowBlurredPreview(false);

        // 🔥 NEW: After purchase, verify dreams are available in Firestore
        // The subscription should have been synced, but double-check to be safe
        try {
          if (!user) return;

          console.log('🔍 Verifying dreams after purchase...');
          const usageRef = doc(db, 'dreamUsage', user.id);
          const usageSnap = await getDoc(usageRef);

          if (usageSnap.exists()) {
            const usageData = usageSnap.data();
            const used = usageData.used || 0;
            const total = usageData.total || 0;

            console.log(`📊 Post-purchase dream check: ${used}/${total}`);

            if (used >= total) {
              Alert.alert('Error', 'Unable to verify dream availability. Please try again in a moment.');
              return;
            }
          }

          console.log('✅ Dreams verified - proceeding with generation');
          await proceedWithGeneration();

          setTimeout(() => {
            Alert.alert(
              '🎉 Success!',
              'Generating your dream cinema...',
              [{ text: 'Great!', style: 'default' }]
            );
          }, 500);

        } catch (error) {
          console.error('❌ Error verifying dreams after purchase:', error);
          Alert.alert('Error', 'Purchase successful! Please tap Generate again to create your dream.');
        }
      }
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRestore = async () => {
    await restorePurchases();
  };

  const renderUsageIndicator = () => {
    return null;
  };

  const canGenerate = Boolean(transcript && promptAnalysis?.canGenerate && !promptAnalysis?.hasAdultContent && !isGenerating);
  const getButtonText = () => {
    if (isGenerating) return 'Creating your dream cinema...';
    if (!transcript) return 'Enter your dream first';
    if (promptAnalysis?.hasAdultContent) return 'Content not available yet 🔞';
    if (!promptAnalysis?.canGenerate) return 'Add more details to generate';
    return 'Generate Dream Cinema';
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="light" backgroundColor="transparent" translucent />
      <LinearGradient colors={['#7C86FF', '#E3C8FF']} style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.logoRow}>
            <Image source={require('../../assets/images/logo.png')} style={styles.logoImg} />
            <Text style={styles.logoWord}>Dream AI</Text>
          </View>

          <View style={styles.micContainer}>
            <TouchableOpacity style={styles.micButton} onPress={recording ? stopRecording : startRecording} activeOpacity={0.8}>
              <Image source={require('../../assets/images/mic.png')} style={styles.micIcon} />
              {recording && (
                <View style={styles.recIndicatorInside}><View style={styles.recDot} /><Text style={styles.recText}>REC</Text></View>
              )}
            </TouchableOpacity>
            {recording && (
              <View style={styles.waveContainer}>
                {waveAnimations.map((anim, i) => (
                  <Animated.View key={i} style={[styles.waveLine, { height: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 40] }) }]} />
                ))}
              </View>
            )}
          </View>

          <Text style={styles.prompt}>What did you dream?</Text>

          <View style={styles.card}>
            <TextInput
              style={styles.transcriptTextInput}
              multiline
              placeholder={isTranscribing ? 'Transcribing your voice...' : 'Describe your dream...'}
              placeholderTextColor="#ccc"
              value={transcript}
              onChangeText={setTranscript}
              editable
            />

            <PromptStrengthIndicator
              prompt={transcript}
              onAnalysisChange={setPromptAnalysis}
              userLanguage={language}
            />

            <View style={styles.imageSection}>
              <Text style={styles.imageSectionTitle}>Who was in your dream?</Text>
              <Text style={styles.imageSectionSubtitle}>
                Add photos to see them in your dream video ({selectedImages.length}/{MAX_IMAGES})
                {processedImages.size > 0 && ' • Background removed'}
              </Text>

              {isProcessingImage && (
                <View style={styles.processingContainer}><ActivityIndicator size="small" color={DREAM_PURPLE} /><Text style={styles.processingText}>Removing background...</Text></View>
              )}

              <View style={styles.imageGrid}>
                {selectedImages.map((uri, i) => (
                  <View key={i} style={styles.imageContainer}>
                    <Image source={{ uri }} style={styles.selectedImage} />
                    {processedImages.get(uri) && (<View style={styles.processedBadge}><Text style={styles.processedBadgeText}>✨</Text></View>)}
                    <TouchableOpacity style={styles.removeButton} onPress={() => removeImage(i)}><Text style={styles.removeButtonText}>×</Text></TouchableOpacity>
                  </View>
                ))}
                {selectedImages.length < MAX_IMAGES && !isProcessingImage && (
                  <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                    <Text style={styles.addImageIcon}>+</Text><Text style={styles.addImageText}>Add person</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {renderUsageIndicator()}

            <TouchableOpacity
              onPress={handleGenerateDream}
              style={[styles.generateBtn, !canGenerate && styles.generateBtnDisabled]}
              disabled={!canGenerate}
              activeOpacity={0.7}
            >
              <Text style={[styles.generateBtnText, !canGenerate && styles.generateBtnTextDisabled]}>
                {getButtonText()}
              </Text>
            </TouchableOpacity>

            <View>
              <Text style={styles.generatedPreview}>Generated video preview</Text>

              {/* 🔥 FIXED: Render video FIRST, then show loading overlay if still generating */}
              {finalVideoUri ? (
                <View style={styles.previewVideoContainer}>
                  {(isVideoLoading || isGenerating) && (
                    <View style={styles.videoLoadingOverlay}>
                      <ActivityIndicator size="large" color={DREAM_PURPLE} />
                      <Text style={styles.videoLoadingText}>
                        {generationStep || 'Loading video...'}
                      </Text>
                      {isGenerating && generationProgress > 0 && (
                        <View style={styles.progressContainerOverlay}>
                          <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${generationProgress}%` }]} />
                          </View>
                          <Text style={styles.progressTextOverlay}>{Math.round(generationProgress)}%</Text>
                        </View>
                      )}
                    </View>
                  )}
                  <Video
                    key={videoKey}
                    source={{ uri: finalVideoUri }}
                    style={styles.videoPlayer}
                    useNativeControls={true}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay={true}
                    isLooping
                    onLoadStart={() => {
                      console.log('📥 Video loading started...');
                      setIsVideoLoading(true);
                    }}
                    onLoad={() => {
                      console.log('✅ Video loaded successfully!');
                      setIsVideoLoading(false);
                      setIsGenerating(false); // 🔥 CRITICAL: Hide loading screen
                    }}
                    onError={(error) => {
                      console.error('❌ Video error:', error);
                      setIsVideoLoading(false);
                      setIsGenerating(false); // 🔥 CRITICAL: Hide loading screen on error
                      Alert.alert('Video Error', 'Failed to load video');
                    }}
                  />
                  <TouchableOpacity
                    style={styles.viewInLibraryButton}
                    onPress={() => {
                      console.log('📚 View in Library pressed, navigating with dreamId:', completedDreamId);
                      if (completedDreamId) {
                        router.push(`/(tabs)/library?dreamId=${completedDreamId}`);
                      } else {
                        router.push('/(tabs)/library');
                      }
                    }}
                  >
                    <Text style={styles.viewInLibraryText}>View in Library</Text>
                    <Ionicons name="arrow-forward-outline" size={18} color="#7C86FF" style={{ marginLeft: 6 }} />
                  </TouchableOpacity>
                </View>
              ) : isGenerating ? (
                <View style={styles.previewWrapper}>
                  <Image source={require('../../assets/images/dream-preview.png')} style={[styles.previewImage, { opacity: 0.5 }]} blurRadius={8} />
                  <ActivityIndicator size="large" color={DREAM_PURPLE} style={styles.spinner} />
                  <Text style={styles.loadingText}>{generationStep || 'Creating your dream cinema...'}</Text>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${generationProgress}%` }]} /></View>
                    <Text style={styles.progressText}>{Math.round(generationProgress)}%</Text>
                  </View>
                </View>
              ) : showBlurredPreview ? (
                <View style={styles.glassWrapper}>
                  <BlurredDreamPreview
                    onUnlock={() => {
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setShowPaywall(true);
                    }}
                    prompt={transcript}
                  />
                </View>
              ) : coverImage ? (
                <Image source={{ uri: coverImage }} style={styles.previewImage} />
              ) : (
                <Image source={require('../../assets/images/dream-preview.png')} style={styles.previewImage} />
              )}
            </View>
          </View>
        </ScrollView>
      </LinearGradient>

      <SubscriptionModal
        visible={showPaywall}
        onClose={() => {
          setShowPaywall(false);
        }}
        onRestore={handleRestore}
        onSelectPlan={handleSelectPlan}
        currentId={subscription?.id}
        isPurchasing={isPurchasing}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 100 },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 30, transform: [{ translateX: -22 }] },
  logoImg: { width: 72, height: 64, resizeMode: 'contain', marginRight: 3 },
  logoWord: { fontSize: 52, color: '#fff', fontWeight: Platform.OS === 'ios' ? '800' : 'bold', letterSpacing: 0.5 },

  micContainer: { alignItems: 'center', marginTop: 10, marginBottom: 18 },
  micButton: { width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  micIcon: { width: 74, height: 74, tintColor: '#ffffff' },
  recIndicatorInside: { position: 'absolute', bottom: 15, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff4444', marginRight: 6 },
  recText: { color: '#ffffff', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  waveContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 20, height: 50 },
  waveLine: { width: 3, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 1.5, opacity: 0.9 },

  prompt: { fontSize: 28, color: '#fff', marginBottom: 18, fontWeight: Platform.OS === 'ios' ? '700' : 'bold' },
  card: { backgroundColor: '#fff', borderRadius: 20, width: '100%', padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 5, minHeight: 600 },

  transcriptTextInput: { fontSize: 22, color: '#0A2540', fontWeight: Platform.OS === 'ios' ? 'bold' : 'bold', marginTop: 16, marginBottom: 16, minHeight: 100 },

  imageSection: { marginBottom: 20 },
  imageSectionTitle: { fontSize: 18, fontWeight: Platform.OS === 'ios' ? '700' : 'bold', color: '#0A2540', marginBottom: 4 },
  imageSectionSubtitle: { fontSize: 14, color: '#68707D', marginBottom: 12 },
  processingContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F3F4F6', borderRadius: 8 },
  processingText: { marginLeft: 8, fontSize: 14, color: DREAM_PURPLE, fontWeight: '600' },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  imageContainer: { position: 'relative' },
  selectedImage: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: DREAM_PURPLE },
  processedBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: DREAM_PURPLE, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  processedBadgeText: { fontSize: 12 },
  removeButton: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ff4444', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  removeButtonText: { color: '#fff', fontSize: 14, fontWeight: 'bold', lineHeight: 16 },
  addImageButton: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
  addImageIcon: { fontSize: 24, color: DREAM_PURPLE, fontWeight: 'bold', marginBottom: 2 },
  addImageText: { fontSize: 10, color: DREAM_PURPLE, fontWeight: '600', textAlign: 'center' },

  generateBtn: { backgroundColor: DREAM_PURPLE, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 16, alignSelf: 'stretch' },
  generateBtnDisabled: { backgroundColor: '#E5E7EB' },
  generateBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 18, textAlign: 'center' },
  generateBtnTextDisabled: { color: '#9CA3AF' },

  previewImage: { width: '100%', height: 220, borderRadius: 15, resizeMode: 'cover', marginBottom: 12 },
  generatedPreview: { color: DREAM_PURPLE, fontSize: 16, fontWeight: '600', marginBottom: 8, textAlign: 'left' },
  previewWrapper: { position: 'relative', justifyContent: 'center', alignItems: 'center', width: '100%', height: 220, borderRadius: 15, backgroundColor: '#f0f0f0' },
  spinner: { position: 'absolute', top: '35%' },
  loadingText: { position: 'absolute', top: '50%', color: DREAM_PURPLE, fontSize: 16, fontWeight: 'bold' },

  glassWrapper: {
    borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 8 } }, android: { elevation: 6 } }),
  },

  previewVideoContainer: { width: '100%', height: 220, borderRadius: 15, overflow: 'hidden', position: 'relative', backgroundColor: '#000' },
  videoPlayer: { width: '100%', height: '100%' },
  videoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  videoLoadingText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  progressContainerOverlay: {
    marginTop: 20,
    width: '80%',
    alignItems: 'center',
  },
  progressTextOverlay: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  viewInLibraryButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  viewInLibraryText: { color: '#7C86FF', fontSize: 14, fontWeight: '700' },

  progressContainer: { position: 'absolute', top: '65%', width: '80%', alignItems: 'center' },
  progressBar: { width: '100%', height: 8, backgroundColor: 'rgba(114,120,230,0.3)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#7278E6', borderRadius: 4 },
  progressText: { color: '#7278E6', fontSize: 14, fontWeight: '600', marginTop: 8 },
});

const strengthStyles = StyleSheet.create({
  container: { marginBottom: 20, padding: 16, backgroundColor: '#f8f9fa', borderRadius: 12, borderWidth: 1, borderColor: '#e9ecef' },
  emptyMessage: { fontSize: 14, color: '#6c757d', textAlign: 'center', fontStyle: 'italic' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  progressBackground: { flex: 1, height: 8, backgroundColor: '#e9ecef', borderRadius: 4, marginRight: 12, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  scoreText: { fontSize: 14, fontWeight: '600', color: '#495057', minWidth: 45, textAlign: 'right' },
  strengthText: { fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  feedbackContainer: { marginTop: 8 },
  issueText: { fontSize: 14, color: '#dc3545', marginBottom: 4, lineHeight: 18 },
  suggestionsTitle: { fontSize: 14, fontWeight: '600', color: '#495057', marginBottom: 4 },
  suggestionText: { fontSize: 14, color: '#28a745', marginBottom: 4, lineHeight: 18 },

  comingSoonContainer: {
    backgroundColor: '#EEF2FF',
    padding: 14,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#7278E6',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  comingSoonIcon: {
    fontSize: 24,
    marginRight: 10,
    marginTop: 2,
  },
  comingSoonTextContainer: {
    flex: 1,
  },
  comingSoonTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4338CA',
    marginBottom: 6,
  },
  comingSoonText: {
    fontSize: 13,
    color: '#4F46E5',
    lineHeight: 18,
    marginBottom: 8,
  },
  comingSoonHint: {
    fontSize: 12,
    color: '#6366F1',
    fontStyle: 'italic',
  },
});