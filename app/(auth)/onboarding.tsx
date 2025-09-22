// app/(auth)/onboarding.tsx - PSYCHOLOGICAL DREAM QUESTIONS
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
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
    id: 'sleep_hours',
    question: 'How many hours do you\nsleep per night?',
    subtitle: 'We spend 1/3 of our lives asleep',
    options: [
      { icon: 'moon', text: '8-10 hours' },
      { icon: 'moon-outline', text: '6-8 hours' },
      { icon: 'partly-sunny', text: '5 or less' },
      { icon: 'cafe', text: 'It varies' },
    ],
  },
  {
    id: 'realization',
    question: 'That\'s 2,920 hours per year\nin dreams you\'ll never remember',
    subtitle: 'You have photos for your waking memories. Why not your dreams?',
    options: [
      { icon: 'camera', text: 'I want to capture them forever' },
      { icon: 'videocam', text: 'Turn them into movies' },
      { icon: 'trash-outline', text: 'Let 2,920 hours vanish' },
    ],
  },
  {
    id: 'dream_frequency',
    question: 'You dream 4-6 times every night.\nHow many do you remember?',
    subtitle: '95% of dreams vanish within 5 minutes of waking',
    options: [
      { icon: 'sparkles', text: 'Maybe one per week' },
      { icon: 'cloud-outline', text: 'Fragments and feelings' },
      { icon: 'help-circle-outline', text: 'Almost nothing' },
      { icon: 'skull-outline', text: 'They\'re all dead to me' },
    ],
  },
  {
    id: 'dream_capture',
    question: 'What if AI could capture\nyour dreams while you sleep?',
    subtitle: 'Record your dream the moment you wake up',
    options: [
      { icon: 'mic', text: 'Voice record instantly' },
      { icon: 'bed', text: 'Capture while half-asleep' },
      { icon: 'close-circle', text: 'Keep forgetting forever' },
    ],
  },
  {
    id: 'transformation',
    question: 'Your dreams cost you\n10,000 lost memories per lifetime',
    subtitle: 'Every night you\'re creating stories you\'ll never see',
    options: [
      { icon: 'film', text: 'Save my dream movies' },
      { icon: 'book', text: 'Build my dream library' },
      { icon: 'ban', text: 'Waste another 10,000' },
    ],
  },
  {
    id: 'final_hook',
    question: 'While you slept last night,\n6 dreams disappeared forever',
    subtitle: 'Your brain created masterpieces. Gone.',
    options: [
      { icon: 'recording', text: 'Start recording tonight' },
      { icon: 'analytics', text: 'Decode my subconscious' },
      { icon: 'sad-outline', text: 'Accept the loss' },
    ],
  }
];

export default function OnboardingScreen() {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, number>>({});
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  const handleSelectOption = (index: number) => {
    setSelectedOptions(prev => ({
      ...prev,
      [QUESTIONS[currentStep].id]: index
    }));

    // Auto-advance after selection
    setTimeout(() => {
      handleContinue();
    }, 300);
  };

  const handleContinue = () => {
    if (currentStep < QUESTIONS.length - 1) {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep(currentStep + 1);
        // Fade in
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    } else {
      router.push('/(auth)/auth-select');
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setCurrentStep(currentStep - 1);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
    } else {
      router.back();
    }
  };

  const progress = ((currentStep + 1) / QUESTIONS.length) * 100;
  const current = QUESTIONS[currentStep];
  const selectedIndex = selectedOptions[current.id];

  // Special rendering for realization screen
  const isRealizationScreen = currentStep === 1;

  // Check if last option (negative option) is selected
  const isNegativeOption = selectedIndex === current.options.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {/* iOS Back Arrow */}
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
        >
          <Ionicons name="chevron-back" size={28} color="#000" />
        </TouchableOpacity>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progress}%` }]}
            />
          </View>
        </View>
      </View>

      <Animated.View style={[
        styles.content,
        { opacity: fadeAnim }
      ]}>
        {/* Show diagram for sleep calculation */}
        {isRealizationScreen && (
          <View style={styles.diagramContainer}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>8</Text>
              <Text style={styles.statLabel}>hours/night</Text>
            </View>
            <Text style={styles.multiply}>×</Text>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>365</Text>
              <Text style={styles.statLabel}>days/year</Text>
            </View>
            <Text style={styles.equals}>=</Text>
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, styles.highlightNumber]}>2,920</Text>
              <Text style={styles.statLabel}>lost hours</Text>
            </View>
          </View>
        )}

        {/* Question */}
        <View style={styles.questionContainer}>
          <Text style={styles.question}>{current.question}</Text>
          <Text style={styles.subtitle}>{current.subtitle}</Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {current.options.map((option, index) => {
            const isLastOption = index === current.options.length - 1;
            const isSelected = selectedIndex === index;
            
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.optionButton,
                  isSelected && (isLastOption ? styles.negativeButtonSelected : styles.optionButtonSelected),
                  isLastOption && styles.negativeButton
                ]}
                onPress={() => handleSelectOption(index)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={option.icon as any} 
                  size={24} 
                  color={
                    isSelected 
                      ? '#FFFFFF' 
                      : isLastOption 
                        ? '#999' 
                        : '#000'
                  } 
                  style={styles.optionIcon}
                />
                <Text style={[
                  styles.optionText,
                  isLastOption && styles.negativeText,
                  isSelected && styles.optionTextSelected
                ]}>
                  {option.text}
                </Text>
              </TouchableOpacity>
            );
          })}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 20,
  },
  backButton: {
    padding: 4,
    marginRight: 12,
    marginLeft: -8,
  },
  progressContainer: {
    flex: 1,
  },
  progressBar: {
    height: 3,
    backgroundColor: '#F0F0F0',
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7E78EA',
    borderRadius: 1.5,
  },
  skipButton: {
    padding: 4,
    marginLeft: 12,
  },
  skipText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#666',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  diagramContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    paddingVertical: 20,
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#000',
  },
  highlightNumber: {
    color: '#7E78EA',
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginTop: 4,
  },
  multiply: {
    fontSize: 20,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginHorizontal: 15,
  },
  equals: {
    fontSize: 20,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    marginHorizontal: 15,
  },
  questionContainer: {
    marginBottom: 30,
  },
  question: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    color: '#000',
    lineHeight: 40,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    lineHeight: 22,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    backgroundColor: '#7E78EA',
    borderColor: '#7E78EA',
  },
  negativeButton: {
    backgroundColor: '#F5F5F5',
    borderColor: '#E0E0E0',
    borderWidth: 1,
  },
  negativeButtonSelected: {
    backgroundColor: '#666',
    borderColor: '#666',
  },
  optionIcon: {
    marginRight: 16,
    width: 24,
  },
  optionText: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
    flex: 1,
  },
  negativeText: {
    color: '#999',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
});