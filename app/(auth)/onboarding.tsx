import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, auth } from '../config/firebaseConfig';
import { doc, setDoc, increment, serverTimestamp } from 'firebase/firestore';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as StoreReview from 'expo-store-review';
import { Platform } from 'react-native';
import { useSleepData } from '../hooks/useSleepData';

// ---- SAFETY NET: guard all icons so missing glyphs don't crash a step ----
const hasGlyph = (name: string) => (Ionicons as any)?.glyphMap?.[name] != null;
const SafeIonicon = ({ name, size, color }: { name: string; size: number; color: string }) => {
  const safe = hasGlyph(name) ? name : 'star';
  return <Ionicons name={safe as any} size={size} color={color} />;
};
// -------------------------------------------------------------------------

const QUESTIONS = [
  { id: 'math_breakdown', question: 'Your day is split\ninto three parts', subtitle: "Let's break down your 24 hours", type: 'math' },
  { id: 'sleep_third', question: 'You sleep\n1/3 of your life', subtitle: "That's 8 hours every single day" },
  { id: 'photos_app', question: 'You have Photos\nfor your everyday life', subtitle: "Thousands of memories from when you're awake", type: 'photos_icon' },
  { id: 'dream_ai_reveal', question: 'Why not have one\nfor your other 1/3?', subtitle: 'Introducing memories from your sleep', type: 'dream_icon' },
  {
    id: 'science',
    type: 'science',
    question: 'Why do dreams disappear\nso quickly?',
    subtitle: 'The neuroscience behind dream memory',
    facts: [
      { icon: 'flash', title: '5-10 Minute Window', description: 'Dreams live in short-term memory. They vanish unless captured immediately upon waking.', stat: '95% forgotten' },
      { icon: 'cellular', title: 'Brain Chemistry', description: 'During REM sleep, your hippocampus (memory center) is partially shut down. Dreams never reach long-term storage.', stat: 'Harvard Study' },
      { icon: 'time', title: 'The Golden Window', description: 'The first 90 seconds after waking are critical. Voice recording beats typing by 3x for dream recall.', stat: '3x better recall' }
    ]
  },
  { id: 'how_it_works', question: 'Voice record your dream\nthe moment you wake up', subtitle: 'AI transforms your voice into a cinematic video' },
  {
    id: 'fomo_cta',
    type: 'fomo_cta',
    question: 'Imagine Having Videos\nof Your Dreams',
    subtitle: 'Now stop imagining and start recording',
    tagline: 'Your friends will ask how you did it'
  },
  {
    id: 'health_connection',
    type: 'health_connection',
    question: 'Connect to Apple Health',
    subtitle: 'Sync your sleep schedule between Dream AI and the Health app to get reminders at the perfect time.'
  },
  {
    id: 'wake_time_picker',
    type: 'wake_time_picker',
    question: 'When do you\nusually wake up?',
    subtitle: "We'll send reminders at the perfect time"
  },
  {
    id: 'prompt_examples',
    type: 'examples',
    question: 'How to describe your\ndreams for best results',
    subtitle: 'AI creates better videos from vivid descriptions',
    examples: [
      { quality: 'weak', icon: 'close-circle', prompt: 'I had a dream', why: 'Too vague - AI needs details' },
      { quality: 'good', icon: 'checkmark-circle', prompt: 'I was flying over mountains at sunset', why: 'Clear scene + action + setting' },
      { quality: 'amazing', icon: 'star', prompt: 'I was racing a red Ferrari through neon-lit Tokyo streets at midnight in the rain', why: 'Vivid details = cinematic results' }
    ]
  }
];

export default function OnboardingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [wakeTime, setWakeTime] = useState(new Date(new Date().setHours(7, 0, 0, 0)));

  // HealthKit integration hook
  const { authorized, wakeTime: detectedWakeTime, loading, error, requestPermissions } = useSleepData();

  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!fontsLoaded) return null;

  const handleContinue = async () => {
    // TRIGGER REAL iOS HEALTHKIT PERMISSION when user taps Continue on health screen
    if (current.type === 'health_connection' && Platform.OS === 'ios') {
      console.log('📱 Requesting HealthKit permissions...');
      await requestPermissions();

      // Log results
      if (detectedWakeTime) {
        console.log('✅ Successfully read wake time from Health:', detectedWakeTime);
        // Auto-populate the time picker with detected wake time
        setWakeTime(detectedWakeTime);
      } else if (error) {
        console.log('⚠️ HealthKit error:', error);
      }

      // Continue to manual time picker regardless of success/failure
    }

    // Save wake time and trigger App Store review when leaving wake_time_picker
    if (current.type === 'wake_time_picker') {
      // Save wake time to Firestore
      if (auth.currentUser) {
        try {
          const hours = wakeTime.getHours();
          const minutes = wakeTime.getMinutes();
          const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

          const userRef = doc(db, 'users', auth.currentUser.uid);
          await setDoc(userRef, {
            wakeTime: timeString,
            wakeTimeSource: 'manual',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            updatedAt: serverTimestamp()
          }, { merge: true });

          console.log('✅ Wake time saved:', timeString);
        } catch (error) {
          console.error('Failed to save wake time:', error);
        }
      }

      // Trigger native App Store review popup
      try {
        if (await StoreReview.isAvailableAsync()) {
          await StoreReview.requestReview();
          console.log('📱 App Store review requested');
        }
      } catch (error) {
        console.error('Failed to request review:', error);
      }
    }

    // Continue to next screen or auth-select
    if (currentStep < QUESTIONS.length - 1) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);

        if (nextStep === 3) {
          scaleAnim.setValue(1);
          Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        } else if (nextStep === 2) {
          scaleAnim.setValue(0.8);
          Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true })
          ]).start();
        } else {
          scaleAnim.setValue(1);
          Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        }
      });
    } else {
      router.push('/auth-select');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        const prevStep = currentStep - 1;
        setCurrentStep(prevStep);

        if (prevStep === 3) {
          scaleAnim.setValue(1);
          Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        } else if (prevStep === 2) {
          scaleAnim.setValue(0.8);
          Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true })
          ]).start();
        } else {
          scaleAnim.setValue(1);
          Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        }
      });
    } else {
      router.back();
    }
  };

  const progress = ((currentStep + 1) / QUESTIONS.length) * 100;
  const current = QUESTIONS[currentStep] || QUESTIONS[0];

  if (!current) {
    console.error('❌ Current step is undefined:', currentStep);
    return null;
  }

  const isScienceScreen = current.type === 'science';
  const isExamplesScreen = current.type === 'examples';
  const isMathScreen = current.type === 'math';
  const isPhotosIconScreen = current.type === 'photos_icon';
  const isDreamIconScreen = current.type === 'dream_icon';
  const isFomoCTAScreen = current.type === 'fomo_cta';
  const isHealthConnectionScreen = current.type === 'health_connection';
  const isWakeTimePickerScreen = current.type === 'wake_time_picker';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <SafeIonicon name="chevron-back" size={28} color="#000" />
        </TouchableOpacity>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </View>

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* MATH */}
          {isMathScreen && (
            <>
              <View style={styles.questionContainer}>
                <Text style={styles.question}>{current.question}</Text>
                <Text style={styles.subtitle}>{current.subtitle}</Text>
              </View>
              <View style={styles.mathContainer}>
                <View style={styles.mathRow}>
                  <View style={styles.mathBox}>
                    <SafeIonicon name="moon" size={40} color="#7E78EA" />
                    <Text style={styles.mathNumber}>8</Text>
                    <Text style={styles.mathLabel}>Sleep</Text>
                  </View>
                  <Text style={styles.mathPlus}>+</Text>
                  <View style={styles.mathBox}>
                    <SafeIonicon name="briefcase" size={40} color="#4ECDC4" />
                    <Text style={styles.mathNumber}>8</Text>
                    <Text style={styles.mathLabel}>Work</Text>
                  </View>
                  <Text style={styles.mathPlus}>+</Text>
                  <View style={styles.mathBox}>
                    <SafeIonicon name="happy" size={40} color="#FFD93D" />
                    <Text style={styles.mathNumber}>8</Text>
                    <Text style={styles.mathLabel}>Life</Text>
                  </View>
                </View>
                <View style={styles.mathEquals}><Text style={styles.equalsText}>=</Text></View>
                <View style={styles.mathTotal}>
                  <Text style={styles.totalNumber}>24</Text>
                  <Text style={styles.totalLabel}>hours in your day</Text>
                </View>
              </View>
            </>
          )}

          {/* PHOTOS ICON */}
          {isPhotosIconScreen && (
            <>
              <View style={styles.questionContainer}>
                <Text style={styles.question}>{current.question}</Text>
                <Text style={styles.subtitle}>{current.subtitle}</Text>
              </View>
              <View style={styles.iconContainer}>
                <Animated.View style={[styles.appIconWrapper, { transform: [{ scale: scaleAnim }] }]}>
                  <View style={styles.photosAppIcon}>
                    <SafeIonicon name="image" size={80} color="#FFF" />
                  </View>
                  <Text style={styles.appIconLabel}>Photos</Text>
                </Animated.View>

                <View style={styles.iconStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>2/3</Text>
                    <Text style={styles.statLabel}>of your life</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>16hrs</Text>
                    <Text style={styles.statLabel}>every day</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* DREAM ICON */}
          {isDreamIconScreen && (
            <>
              <View style={styles.questionContainer}>
                <Text style={styles.question}>{current.question}</Text>
                <Text style={styles.subtitle}>{current.subtitle}</Text>
              </View>
              <View style={styles.iconContainer}>
                <View style={styles.appIconWrapper}>
                  <View style={styles.dreamAppIcon}>
                    <Image
                      source={require('../../assets/images/logodreamai.png')}
                      style={{
                        width: 120,
                        height: 120,
                        resizeMode: 'contain',
                      }}
                    />
                  </View>
                  <Text style={styles.appIconLabel}>Dream AI</Text>
                </View>

                <View style={styles.iconStats}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statNumber, styles.highlightStat]}>1/3</Text>
                    <Text style={styles.statLabel}>of your life</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={[styles.statNumber, styles.highlightStat]}>8hrs</Text>
                    <Text style={styles.statLabel}>every night</Text>
                  </View>
                </View>

                <View style={styles.revelationBox}>
                  <SafeIonicon name="bulb" size={24} color="#FFD93D" />
                  <Text style={styles.revelationText}>A whole new memory library</Text>
                </View>
              </View>
            </>
          )}

          {/* HEALTH CONNECTION (EXACT Cal.ai style) */}
          {isHealthConnectionScreen && (
            <>
              {/* Image from Canva - centered with proper spacing */}
              <View style={styles.healthImageContainer}>
                <Image
                  source={require('../../assets/images/health.png')}
                  style={styles.healthFlowImage}
                  resizeMode="contain"
                />
              </View>

              {/* Heading + Subtitle (Cal.ai style) */}
              <View style={styles.healthTextContainer}>
                <Text style={styles.healthHeading}>Connect to{'\n'}Apple Health</Text>
                <Text style={styles.healthSubtitle}>
                  Sync your sleep schedule between Dream AI and the Health app to get reminders at the perfect time.
                </Text>
              </View>
            </>
          )}

          {/* WAKE TIME PICKER (iOS native) */}
          {isWakeTimePickerScreen && (
            <>
              <View style={styles.questionContainer}>
                <Text style={styles.question}>{current.question}</Text>
                <Text style={styles.subtitle}>{current.subtitle}</Text>
              </View>

              <View style={styles.timePickerContainer}>
                <View style={styles.timePickerWrapper}>
                  <DateTimePicker
                    value={wakeTime}
                    mode="time"
                    display="spinner"
                    onChange={(_event, selectedTime) => {
                      if (selectedTime) {
                        setWakeTime(selectedTime);
                      }
                    }}
                    style={styles.timePicker}
                    textColor="#000"
                  />
                </View>

                <View style={styles.timePickerInfo}>
                  <SafeIonicon name="information-circle-outline" size={20} color="#7E78EA" />
                  <Text style={styles.timePickerInfoText}>
                    Notifications at {wakeTime.getHours()}:{wakeTime.getMinutes().toString().padStart(2, '0')} ± 10 minutes
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* FOMO CTA */}
          {isFomoCTAScreen && (
            <>
              <View style={styles.questionContainer}>
                <Text style={styles.question}>{current.question}</Text>
                <Text style={styles.subtitle}>{current.subtitle}</Text>
              </View>

              <View style={styles.fomoContainer}>
                <View style={styles.fomoVideoMockup}>
                  <View style={styles.fomoVideoInner}>
                    <SafeIonicon name="play-circle" size={64} color="#7E78EA" />
                    <Text style={styles.fomoVideoLabel}>Your Dream Video</Text>
                  </View>
                  <View style={styles.fomoShareBadge}>
                    <SafeIonicon name="share-social" size={16} color="#FFF" />
                    <Text style={styles.fomoShareText}>Share</Text>
                  </View>
                </View>

                <View style={styles.fomoStatsRow}>
                  <View style={styles.fomoStatItem}>
                    <Text style={styles.fomoStatNumber}>50K+</Text>
                    <Text style={styles.fomoStatLabel}>dreams recorded</Text>
                  </View>
                  <View style={styles.fomoStatDivider} />
                  <View style={styles.fomoStatItem}>
                    <Text style={styles.fomoStatNumber}>1.2M</Text>
                    <Text style={styles.fomoStatLabel}>videos shared</Text>
                  </View>
                </View>

                <View style={styles.fomoTaglineBox}>
                  <SafeIonicon name="sparkles" size={20} color="#FFD93D" />
                  <Text style={styles.fomoTagline}>{current.tagline}</Text>
                </View>
              </View>
            </>
          )}

          {/* REGULAR QUESTION */}
          {!isMathScreen && !isPhotosIconScreen && !isDreamIconScreen && !isScienceScreen && !isExamplesScreen && !isFomoCTAScreen && !isHealthConnectionScreen && !isWakeTimePickerScreen && (
            <View style={styles.questionContainer}>
              <Text style={styles.question}>{current.question}</Text>
              <Text style={styles.subtitle}>{current.subtitle}</Text>
            </View>
          )}

          {/* SCIENCE */}
          {isScienceScreen && (
            <>
              <View style={styles.questionContainer}>
                <Text style={styles.question}>{current.question}</Text>
                <Text style={styles.subtitle}>{current.subtitle}</Text>
              </View>
              <View style={styles.scienceContainer}>
                {current.facts.map((fact, index) => (
                  <View key={index} style={styles.factCard}>
                    <View style={styles.factHeader}>
                      <View style={styles.factIconContainer}>
                        <SafeIonicon name={fact.icon as any} size={24} color="#7E78EA" />
                      </View>
                      <View style={styles.factTitleContainer}>
                        <Text style={styles.factTitle}>{fact.title}</Text>
                        <View style={styles.factBadge}><Text style={styles.factBadgeText}>{fact.stat}</Text></View>
                      </View>
                    </View>
                    <Text style={styles.factDescription}>{fact.description}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* EXAMPLES */}
          {isExamplesScreen && (
            <>
              <View style={styles.questionContainer}>
                <Text style={styles.question}>{current.question}</Text>
                <Text style={styles.subtitle}>{current.subtitle}</Text>
              </View>
              <View style={styles.examplesContainer}>
                {current.examples.map((example, index) => (
                  <View
                    key={index}
                    style={[
                      styles.exampleCard,
                      example.quality === 'weak' && styles.exampleWeak,
                      example.quality === 'good' && styles.exampleGood,
                      example.quality === 'amazing' && styles.exampleAmazing,
                    ]}
                  >
                    <View style={styles.exampleHeader}>
                      <SafeIonicon
                        name={example.icon as any}
                        size={28}
                        color={example.quality === 'weak' ? '#FF6B6B' : example.quality === 'good' ? '#4ECDC4' : '#FFD93D'}
                      />
                      <Text
                        style={[
                          styles.exampleQuality,
                          example.quality === 'weak' && styles.qualityWeak,
                          example.quality === 'good' && styles.qualityGood,
                          example.quality === 'amazing' && styles.qualityAmazing,
                        ]}
                      >
                        {example.quality.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.examplePrompt}>"{example.prompt}"</Text>
                    <Text style={styles.exampleWhy}>{example.why}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* CONTINUE BUTTON */}
          <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
            <Text style={styles.continueButtonText}>
              {isScienceScreen
                ? 'Got it! Continue'
                : isExamplesScreen
                ? 'I understand'
                : isFomoCTAScreen
                ? 'Record Dreams'
                : isHealthConnectionScreen
                ? 'Continue'
                : isWakeTimePickerScreen
                ? 'Save & Continue'
                : 'Continue'}
            </Text>
            <SafeIonicon name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>

          {/* SKIP BUTTON FOR HEALTH CONNECTION */}
          {isHealthConnectionScreen && (
            <TouchableOpacity
              style={styles.healthSkipButton}
              onPress={() => {
                // Skip HealthKit and go to next screen
                if (currentStep < QUESTIONS.length - 1) {
                  Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
                    setCurrentStep(currentStep + 1);
                    scaleAnim.setValue(1);
                    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
                  });
                }
              }}
            >
              <Text style={styles.healthSkipButtonText}>Skip</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 10, paddingBottom: 20 },
  backButton: { padding: 4, marginRight: 12, marginLeft: -8 },
  progressContainer: { flex: 1 },
  progressBar: { height: 3, backgroundColor: '#F0F0F0', borderRadius: 1.5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#7E78EA', borderRadius: 1.5 },
  content: { flex: 1, paddingHorizontal: 24, paddingVertical: 20 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
    paddingTop: 20,
    minHeight: 500
  },
  questionContainer: { marginBottom: 40 },
  question: { fontSize: 32, fontFamily: 'Inter_700Bold', color: '#000', lineHeight: 40, letterSpacing: -0.5, marginBottom: 12, textAlign: 'center' },
  subtitle: { fontSize: 16, fontFamily: 'Inter_400Regular', color: '#666', lineHeight: 24, textAlign: 'center' },

  // Math
  mathContainer: { alignItems: 'center', marginTop: 20 },
  mathRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  mathBox: { alignItems: 'center', backgroundColor: '#F8F8F8', padding: 20, borderRadius: 16, minWidth: 90 },
  mathNumber: { fontSize: 32, fontFamily: 'Inter_700Bold', color: '#000', marginTop: 8 },
  mathLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#666', marginTop: 4 },
  mathPlus: { fontSize: 28, fontFamily: 'Inter_600SemiBold', color: '#666', marginHorizontal: 12 },
  mathEquals: { marginVertical: 20 },
  equalsText: { fontSize: 32, fontFamily: 'Inter_600SemiBold', color: '#666' },
  mathTotal: { alignItems: 'center', backgroundColor: '#7E78EA', paddingVertical: 24, paddingHorizontal: 48, borderRadius: 20 },
  totalNumber: { fontSize: 48, fontFamily: 'Inter_700Bold', color: '#FFF' },
  totalLabel: { fontSize: 16, fontFamily: 'Inter_500Medium', color: '#FFF', marginTop: 4, opacity: 0.9 },

  // Icons screens
  iconContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  appIconWrapper: { alignItems: 'center', marginBottom: 30 },
  photosAppIcon: { width: 120, height: 120, borderRadius: 28, backgroundColor: '#007AFF', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  dreamAppIcon: { width: 120, height: 120, borderRadius: 28, backgroundColor: '#7E78EA', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#7E78EA', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  appIconLabel: { fontSize: 20, fontFamily: 'Inter_600SemiBold', color: '#000' },
  iconStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F8F8', paddingVertical: 20, paddingHorizontal: 32, borderRadius: 16, gap: 24, marginBottom: 24 },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#000' },
  highlightStat: { color: '#7E78EA' },
  statLabel: { fontSize: 12, fontFamily: 'Inter_400Regular', color: '#666', marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: '#DDD' },
  revelationBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFEF0', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, gap: 8, borderWidth: 1, borderColor: '#FFD93D' },
  revelationText: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: '#000' },

  // Science
  scienceContainer: { gap: 16 },
  factCard: { backgroundColor: '#F8F8FF', borderRadius: 16, padding: 20, borderLeftWidth: 4, borderLeftColor: '#7E78EA' },
  factHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  factIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  factTitleContainer: { flex: 1 },
  factTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: '#000', marginBottom: 6 },
  factBadge: { alignSelf: 'flex-start', backgroundColor: '#7E78EA', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  factBadgeText: { fontSize: 11, fontFamily: 'Inter_600SemiBold', color: '#FFF' },
  factDescription: { fontSize: 15, fontFamily: 'Inter_400Regular', color: '#333', lineHeight: 22 },

  // Examples
  examplesContainer: { gap: 16 },
  exampleCard: { borderRadius: 16, padding: 20, borderWidth: 2 },
  exampleWeak: { backgroundColor: '#FFF5F5', borderColor: '#FF6B6B' },
  exampleGood: { backgroundColor: '#F0FFFF', borderColor: '#4ECDC4' },
  exampleAmazing: { backgroundColor: '#FFFEF0', borderColor: '#FFD93D' },
  exampleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  exampleQuality: { fontSize: 12, fontFamily: 'Inter_700Bold', marginLeft: 8 },
  qualityWeak: { color: '#FF6B6B' },
  qualityGood: { color: '#4ECDC4' },
  qualityAmazing: { color: '#FFA500' },
  examplePrompt: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#000', marginBottom: 8, lineHeight: 22 },
  exampleWhy: { fontSize: 14, fontFamily: 'Inter_400Regular', color: '#666', lineHeight: 20 },

  // Preview
  previewContainer: { gap: 20 },
  videoPreview: { backgroundColor: '#F8F8FF', borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 2, borderColor: '#7E78EA', borderStyle: 'dashed' },
  previewDuration: { fontSize: 24, fontFamily: 'Inter_700Bold', color: '#7E78EA', marginTop: 12 },
  previewQuality: { fontSize: 14, fontFamily: 'Inter_500Medium', color: '#666', marginTop: 4 },
  scenesContainer: { gap: 12 },
  sceneItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F8F8', padding: 16, borderRadius: 12 },
  sceneNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#7E78EA', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sceneNumberText: { fontSize: 16, fontFamily: 'Inter_700Bold', color: '#FFF' },
  sceneText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', color: '#000' },
  previewFeatures: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16 },
  featureItem: { alignItems: 'center', gap: 6 },
  featureText: { fontSize: 12, fontFamily: 'Inter_500Medium', color: '#666' },

  // CTA
  continueButton: { flexDirection: 'row', backgroundColor: '#7E78EA', paddingVertical: 18, paddingHorizontal: 24, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  continueButtonText: { fontSize: 17, fontFamily: 'Inter_600SemiBold', color: '#FFF' },

  // FOMO CTA
  fomoContainer: {
    gap: 24,
    marginTop: 20
  },
  fomoVideoMockup: {
    position: 'relative',
    backgroundColor: '#F8F8FF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#7E78EA',
    shadowColor: '#7E78EA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8
  },
  fomoVideoInner: {
    alignItems: 'center',
    gap: 12
  },
  fomoVideoLabel: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#7E78EA'
  },
  fomoShareBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7E78EA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6
  },
  fomoShareText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFF'
  },
  fomoStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F8F8',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 24
  },
  fomoStatItem: {
    alignItems: 'center'
  },
  fomoStatNumber: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#7E78EA'
  },
  fomoStatLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 4
  },
  fomoStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#DDD'
  },
  fomoTaglineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFEF0',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FFD93D'
  },
  fomoTagline: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
    textAlign: 'center'
  },

  // Sleep Connection
  sleepConnectionContainer: {
    alignItems: 'center',
    marginTop: 30
  },
  sleepIconsRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 32,
    justifyContent: 'center'
  },
  sleepIconItem: {
    alignItems: 'center'
  },
  sleepIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4
  },
  sleepIconLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#000'
  },
  sleepBenefitBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8FF',
    padding: 20,
    borderRadius: 16,
    gap: 16,
    borderWidth: 2,
    borderColor: '#7E78EA',
    width: '100%'
  },
  sleepBenefitText: {
    flex: 1
  },
  sleepBenefitTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#000',
    marginBottom: 4
  },
  sleepBenefitSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    lineHeight: 20
  },

  // Time Picker
  timePickerContainer: {
    alignItems: 'center',
    marginTop: 20,
    width: '100%'
  },
  timePickerWrapper: {
    backgroundColor: '#F8F8F8',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    width: '100%',
    alignItems: 'center'
  },
  timePicker: {
    height: 200,
    width: '100%'
  },
  timePickerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8FF',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    width: '100%'
  },
  timePickerInfoText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: '#666',
    lineHeight: 20
  },

  // Health Connection (EXACT Cal.ai layout)
  healthImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    marginBottom: 32,
    paddingHorizontal: 20
  },
  healthFlowImage: {
    width: '90%',
    height: 280,
    maxWidth: 400
  },
  healthTextContainer: {
    paddingHorizontal: 24,
    marginBottom: 40
  },
  healthHeading: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    color: '#000',
    lineHeight: 38,
    marginBottom: 16,
    textAlign: 'left'
  },
  healthSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    lineHeight: 24,
    textAlign: 'left'
  },
  healthSkipButton: {
    marginTop: 16,
    padding: 12
  },
  healthSkipButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#7E78EA',
    textAlign: 'center'
  }
});