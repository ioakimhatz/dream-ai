// app/(auth)/showcase.tsx - VISUAL DEMO
// ============================================
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function ShowcaseScreen() {
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Skip button */}
        <TouchableOpacity 
          style={styles.skipButton}
          onPress={() => router.push('/(auth)/onboarding')}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Demo Video/Image */}
        <Animated.View style={[
          styles.demoContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}>
          {/* This would be your actual dream video preview */}
          <LinearGradient
            colors={['#7C86FF', '#E3C8FF']}
            style={styles.demoVideo}
          >
            <Text style={styles.demoIcon}>🎬</Text>
            <Text style={styles.demoText}>Dream Cinema</Text>
          </LinearGradient>
        </Animated.View>

        {/* Headline */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text style={styles.headline}>
            Cinema-quality dreams{'\n'}from your voice
          </Text>
          <Text style={styles.subheadline}>
            Just speak your dream and watch it come to life
          </Text>
        </Animated.View>

        {/* Get Started Button */}
        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={() => router.push('/(auth)/onboarding')}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#7278E6', '#E879F9']}
            style={styles.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.buttonText}>Get Started</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Sign In Link */}
        <TouchableOpacity onPress={() => router.push('/(auth)/signin')}>
          <Text style={styles.signInText}>
            Already have an account? <Text style={styles.signInLink}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 40,
  },
  skipButton: {
    alignSelf: 'flex-end',
    padding: 8,
  },
  skipText: {
    fontSize: 17,
    color: '#86868B',
    fontWeight: '500',
  },
  demoContainer: {
    width: width - 48,
    height: 400,
    marginVertical: 40,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  demoVideo: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoIcon: {
    fontSize: 72,
    marginBottom: 16,
  },
  demoText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headline: {
    fontSize: 34,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 40,
  },
  subheadline: {
    fontSize: 17,
    color: '#86868B',
    textAlign: 'center',
    marginBottom: 40,
  },
  getStartedButton: {
    width: '100%',
    marginBottom: 20,
  },
  buttonGradient: {
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  signInText: {
    fontSize: 15,
    color: '#86868B',
    textAlign: 'center',
  },
  signInLink: {
    color: '#7278E6',
    fontWeight: '600',
  },
});