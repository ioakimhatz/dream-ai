// app/(auth)/onboarding.tsx - OPTIONAL ENHANCED ONBOARDING EXPERIENCE
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Animated,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: string;
  feature: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: 'Speak Your Dreams',
    description: 'Simply describe what you dreamed about using your voice or by typing',
    icon: '🎤',
    feature: 'Voice-to-dream technology',
  },
  {
    id: 2,
    title: 'Add Your Face',
    description: 'Upload photos to see yourself or others in your dream videos',
    icon: '📸',
    feature: 'AI face integration',
  },
  {
    id: 3,
    title: 'Watch Magic Happen',
    description: 'Get stunning 18-second cinematic videos in minutes, not hours',
    icon: '🎬',
    feature: '3-clip cinema generation',
  },
];

export default function OnboardingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const nextStep = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        setCurrentStep(currentStep + 1);
        scrollViewRef.current?.scrollTo({ x: (currentStep + 1) * width, animated: true });
      }, 150);
    } else {
      handleGetStarted();
    }
  };

  const skipOnboarding = () => {
    router.replace('/(auth)/signup');
  };

  const handleGetStarted = () => {
    router.replace('/(auth)/signup');
  };

  const currentStepData = ONBOARDING_STEPS[currentStep];

  return (
    <LinearGradient colors={['#7C86FF', '#E3C8FF']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Skip Button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={skipOnboarding} style={styles.skipButton}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Logo */}
        <View style={styles.logoSection}>
          <Text style={styles.logoIcon}>✨🌙✨</Text>
          <Text style={styles.logoText}>Dream AI</Text>
        </View>

        {/* Main Content */}
        <View style={styles.contentContainer}>
          <Animated.View style={[styles.stepContent, { opacity: fadeAnim }]}>
            {/* Feature Icon */}
            <View style={styles.featureIconContainer}>
              <Text style={styles.featureIcon}>{currentStepData.icon}</Text>
            </View>

            {/* Step Info */}
            <Text style={styles.stepTitle}>{currentStepData.title}</Text>
            <Text style={styles.stepDescription}>{currentStepData.description}</Text>
            
            {/* Feature Badge */}
            <View style={styles.featureBadge}>
              <Text style={styles.featureBadgeText}>{currentStepData.feature}</Text>
            </View>
          </Animated.View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          {/* Progress Indicators */}
          <View style={styles.progressContainer}>
            {ONBOARDING_STEPS.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index === currentStep && styles.progressDotActive,
                ]}
              />
            ))}
          </View>

          {/* Action Button */}
          <TouchableOpacity style={styles.actionButton} onPress={nextStep}>
            <LinearGradient
              colors={['#7278E6', '#E879F9']}
              style={styles.actionButtonGradient}
            >
              <Text style={styles.actionButtonText}>
                {currentStep === ONBOARDING_STEPS.length - 1 ? 'Get Started' : 'Next'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Step Counter */}
          <Text style={styles.stepCounter}>
            {currentStep + 1} of {ONBOARDING_STEPS.length}
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  skipButton: {
    padding: 12,
  },
  skipText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },

  // ========== LOGO SECTION ==========
  logoSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  logoIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  logoText: {
    fontSize: 52,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ========== CONTENT ==========
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  stepContent: {
    alignItems: 'center',
  },
  featureIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  featureIcon: {
    fontSize: 64,
  },
  stepTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  stepDescription: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 24,
  },
  featureBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  featureBadgeText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
  },

  // ========== BOTTOM SECTION ==========
  bottomSection: {
    paddingHorizontal: 40,
    paddingBottom: 40,
    alignItems: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    marginBottom: 32,
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressDotActive: {
    backgroundColor: '#fff',
    width: 24,
  },
  actionButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  actionButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  stepCounter: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '500',
  },
});