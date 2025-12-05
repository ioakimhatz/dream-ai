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
  },
  { id: 'how_it_works', question: 'Voice record your dream\nthe moment you wake up', subtitle: 'AI transforms your voice into a cinematic video' },
  {
    id: 'preview',
    type: 'preview',
    question: 'Your first dream will be\na 15-second cinematic video',
    subtitle: 'AI will create 3 scenes from your description',
    preview: { scenes: ['Opening scene', 'Main action', 'Epic finale'], duration: '15 seconds', quality: 'HD cinematic' }
  },
  { id: 'final', question: 'Ready to capture\nyour dream memories?', subtitle: 'Start building your complete memory library tonight' },
  { id: 'referral', type: 'referral', question: 'Enter referral code', subtitle: '(optional)', secondarySubtitle: 'You can skip this step' }
];

export default function OnboardingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [referralCode, setReferralCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!fontsLoaded) return null;

  // Handle referral code submission
  const handleReferralSubmit = async () => {
    if (!referralCode.trim()) {
      router.push('/auth-select');
      return;
    }

    // Prevent double submission
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const code = referralCode.trim().toUpperCase();

      // Check if already submitted (prevent spam)
      const alreadySubmitted = await AsyncStorage.getItem('referralSubmitted');
      if (alreadySubmitted === 'true') {
        console.log('⚠️ Referral already submitted, skipping');
        router.push('/auth-select');
        return;
      }

      // Store code in AsyncStorage
      await AsyncStorage.setItem('referralCode', code);
      await AsyncStorage.setItem('referralSubmitted', 'true'); // Mark as submitted

      // Update Firestore referrals document
      const referralDocRef = doc(db, 'referrals', code);
      await setDoc(referralDocRef, {
        code: code,
        installs: increment(1),
        lastInstall: serverTimestamp()
      }, { merge: true });

      // If user is authenticated, also update their user document
      if (auth.currentUser) {
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userDocRef, {
          referralCode: code,
          referredAt: serverTimestamp()
        }, { merge: true });
      }

      console.log('✅ Referral code saved:', code);
    } catch (error) {
      // Log error but don't block user from continuing
      console.error('Failed to save referral code:', error);
    } finally {
      setIsSubmitting(false);
      router.push('/auth-select');
    }
  };

  // Handle skip button
  const handleReferralSkip = () => {
    router.push('/auth-select');
  };

  const handleContinue = () => {
    if (currentStep < QUESTIONS.length - 1) {
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);

        if (nextStep === 3) {
          scaleAnim.setValue(1);
          Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        }
        else if (nextStep === 2) {
          scaleAnim.setValue(0.8);
          Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
            Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true })
          ]).start();
        }
        else {
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
  const isPreviewScreen = current.type === 'preview';
  const isMathScreen = current.type === 'math';
  const isPhotosIconScreen = current.type === 'photos_icon';
  const isDreamIconScreen = current.type === 'dream_icon';
  const isReferralScreen = current.type === 'referral';

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

          {/* REFERRAL */}
          {isReferralScreen && (
            <View style={styles.referralWrapper}>
              <View style={styles.questionContainer}>
                <Text style={styles.question}>{current.question}</Text>
                <Text style={styles.subtitle}>{current.subtitle}</Text>
                {current.secondarySubtitle && (
                  <Text style={styles.secondarySubtitle}>{current.secondarySubtitle}</Text>
                )}
              </View>
              <View style={styles.referralInputContainer}>
                {/* Input + Submit on same row */}
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.referralInput}
                    placeholder="Referral Code"
                    placeholderTextColor="#999"
                    value={referralCode}
                    onChangeText={setReferralCode}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    editable={!isSubmitting}
                  />
                  <TouchableOpacity
                    style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                    onPress={handleReferralSubmit}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.submitButtonText}>
                      {isSubmitting ? 'Submitting...' : 'Submit'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              {/* Skip button at absolute bottom */}
              <View style={styles.skipButtonContainer}>
                <TouchableOpacity style={styles.skipButton} onPress={handleReferralSkip} disabled={isSubmitting}>
                  <Text style={styles.skipButtonText}>Skip</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* REGULAR QUESTION */}
          {!isMathScreen && !isPhotosIconScreen && !isDreamIconScreen && !isScienceScreen && !isExamplesScreen && !isPreviewScreen && !isReferralScreen && (
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

          {/* PREVIEW */}
          {isPreviewScreen && (
            <>
              <View style={styles.questionContainer}>
                <Text style={styles.question}>{current.question}</Text>
                <Text style={styles.subtitle}>{current.subtitle}</Text>
              </View>
              <View style={styles.previewContainer}>
                <View style={styles.videoPreview}>
                  <SafeIonicon name="film" size={48} color="#7E78EA" />
                  <Text style={styles.previewDuration}>{current.preview.duration}</Text>
                  <Text style={styles.previewQuality}>{current.preview.quality}</Text>
                </View>
                <View style={styles.scenesContainer}>
                  {current.preview.scenes.map((scene, index) => (
                    <View key={index} style={styles.sceneItem}>
                      <View style={styles.sceneNumber}><Text style={styles.sceneNumberText}>{index + 1}</Text></View>
                      <Text style={styles.sceneText}>{scene}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.previewFeatures}>
                  <View style={styles.featureItem}>
                    <SafeIonicon name="videocam" size={20} color="#7E78EA" />
                    <Text style={styles.featureText}>HD Quality</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <SafeIonicon name="musical-notes" size={20} color="#7E78EA" />
                    <Text style={styles.featureText}>Sound Effects</Text>
                  </View>
                  <View style={styles.featureItem}>
                    <SafeIonicon name="sparkles" size={20} color="#7E78EA" />
                    <Text style={styles.featureText}>AI Enhanced</Text>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* CONTINUE BUTTON */}
          {!isReferralScreen && (
            <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
              <Text style={styles.continueButtonText}>
                {isScienceScreen ? 'Got it! Continue' : isExamplesScreen ? 'I understand' : isPreviewScreen ? 'Ready to create!' : 'Continue'}
              </Text>
              <SafeIonicon name="arrow-forward" size={20} color="#FFF" />
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

  // Referral
  referralWrapper: {
    flex: 1,
    position: 'relative'
  },
  referralInputContainer: {
    marginTop: 20
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center'
  },
  referralInput: {
    flex: 1,
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    color: '#000',
    textAlign: 'center'
  },
  submitButton: {
    backgroundColor: '#7E78EA',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  submitButtonDisabled: {
    opacity: 0.5
  },
  submitButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFF'
  },
  skipButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 0
  },
  skipButton: {
    backgroundColor: '#7E78EA',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  skipButtonText: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFF'
  },
  secondarySubtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#999',
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 4
  },
});