// app/(auth)/onboarding.tsx - QUESTIONS
// ============================================
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const QUESTIONS = [
  {
    id: 'dream_frequency',
    question: 'How often do you\nremember your dreams?',
    options: ['Every morning', 'Few times a week', 'Rarely', 'Never'],
  },
  {
    id: 'dream_type',
    question: 'What dreams excite\nyou most?',
    options: ['Adventure & Action', 'Surreal & Abstract', 'Romantic & Emotional', 'Dark & Mysterious'],
  },
  {
    id: 'creation_goal',
    question: 'What will you create\nwith Dream AI?',
    options: ['Share on social media', 'Personal dream journal', 'Art & creativity', 'Explore my mind'],
  },
];

export default function OnboardingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const slideAnim = useRef(new Animated.Value(0)).current;

  const handleAnswer = (answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [QUESTIONS[currentStep].id]: answer
    }));

    if (currentStep < QUESTIONS.length - 1) {
      // Animate to next
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: -width,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: width,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        })
      ]).start(() => {
        setCurrentStep(currentStep + 1);
      });
    } else {
      // Save answers and go to auth
      router.push('/(auth)/auth-select' as any);
    }
  };

  const progress = ((currentStep + 1) / QUESTIONS.length) * 100;
  const current = QUESTIONS[currentStep];

  return (
    <SafeAreaView style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <LinearGradient
            colors={['#7278E6', '#E879F9']}
            style={[styles.progressFill, { width: `${progress}%` }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
        </View>
      </View>

      {/* Back Button */}
      {currentStep > 0 && (
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setCurrentStep(currentStep - 1)}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
      )}

      <Animated.View style={[
        styles.content,
        { transform: [{ translateX: slideAnim }] }
      ]}>
        <Text style={styles.question}>{current.question}</Text>

        <View style={styles.optionsContainer}>
          {current.options.map((option) => (
            <TouchableOpacity
              key={option}
              style={styles.optionButton}
              onPress={() => handleAnswer(option)}
              activeOpacity={0.7}
            >
              <Text style={styles.optionText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  progressContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    marginBottom: 20,
  },
  progressBar: {
    height: 3,
    backgroundColor: '#F0F0F2',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 24,
    zIndex: 10,
    padding: 8,
  },
  backText: {
    fontSize: 28,
    color: '#000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  question: {
    fontSize: 36,
    fontWeight: '900',
    color: '#000',
    marginBottom: 60,
    lineHeight: 42,
  },
  optionsContainer: {
    gap: 16,
  },
  optionButton: {
    backgroundColor: '#F5F5F7',
    paddingVertical: 22,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
});
