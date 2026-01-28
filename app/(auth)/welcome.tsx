// app/(auth)/welcome.tsx - WITH VIDEO MOCKUP
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Video, ResizeMode } from 'expo-av';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const video = useRef(null);
  const [status, setStatus] = useState({});

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (!fontsLoaded) return;

    StatusBar.setBarStyle('dark-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('#FFFFFF');
    }

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View style={styles.safeWrapper}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.innerContainer}>
          {/* Visual Section - Top 60% */}
          <Animated.View style={[
            styles.visualContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}>
            {/* Video mockup - SMALLER SIZE like Cal AI */}
            <View style={styles.phoneContainer}>
              <Video
                ref={video}
                style={styles.phoneVideo}
                source={{
                  uri: 'https://res.cloudinary.com/dsfqvxje5/video/upload/v1768488248/s0cfysftu2pinczyjmvp.mov',
                }}
                useNativeControls={false}
                resizeMode={ResizeMode.CONTAIN}
                isLooping
                shouldPlay
                onPlaybackStatusUpdate={status => setStatus(() => status)}
              />
            </View>
          </Animated.View>

          {/* Bottom Section - Bottom 40% */}
          <Animated.View style={[
            styles.bottomSection,
            { opacity: fadeAnim }
          ]}>
            {/* Title */}
            <Text style={styles.title}>
              Turn dreams into{'\n'}reality
            </Text>

            {/* Get Started Button */}
            <TouchableOpacity
              style={styles.getStartedButton}
              onPress={() => router.push('/(auth)/onboarding')}
              activeOpacity={0.9}
            >
              <Text style={styles.getStartedText}>Get Started</Text>
            </TouchableOpacity>

            {/* Sign In Link */}
            <View style={styles.signInContainer}>
              <Text style={styles.signInPrompt}>
                Already have an account?{' '}
                <Text
                  style={styles.signInLink}
                  onPress={() => router.push('/(auth)/signin')}
                >
                  Sign In
                </Text>
              </Text>
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  innerContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Visual Section - Balanced like Cal AI
  visualContainer: {
    flex: 1.8,  // Increased even more to make top section bigger
    paddingTop: 120,  // REDUCED from 150 → 120 (moves UP)
    alignItems: 'center',
    justifyContent: 'center',  // Centers in container
    paddingBottom: 0,  // No bottom padding to stay close to title
    backgroundColor: '#FFFFFF',
    zIndex: 10,  // Front layer
  },

  // Phone container for proper video sizing
  phoneContainer: {
    width: width * 1.0,
    height: height * 0.55,
    maxWidth: 500,
    maxHeight: 600,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -50,  // Higher
    marginBottom: 20,
    zIndex: 10,
  },

  // Video styling - matches Cal AI size
  phoneVideo: {
    width: '100%',
    height: '100%',
    borderRadius: 35,  // Rounded corners for phone mockup effect
    overflow: 'hidden',
  },

  // Bottom Section - Better proportioned
  bottomSection: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 30,
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    backgroundColor: '#FFFFFF',
    zIndex: 1,  // Back layer (behind video)
  },

  // Title with proper spacing
  title: {
    fontSize: 36,  // Slightly smaller for balance
    fontFamily: 'Inter_700Bold',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 15,
    marginTop: 10,  // Positive space between video and title
    lineHeight: 46,
    letterSpacing: 0.5,
  },

  // Purple button - Full width
  getStartedButton: {
    backgroundColor: '#7E78EA',
    paddingVertical: 19,
    paddingHorizontal: 50,
    borderRadius: 30,
    alignItems: 'center',
    marginBottom: 20,
    marginHorizontal: 0,
    width: '100%',
  },

  getStartedText: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },

  // Sign in section
  signInContainer: {
    paddingTop: 0,
    paddingBottom: 10,
    alignItems: 'center',
  },

  signInPrompt: {
    fontSize: 17,
    fontFamily: 'Inter_400Regular',
    color: '#666666',
    textAlign: 'center',
    letterSpacing: 0.3,
  },

  signInLink: {
    fontFamily: 'Inter_600SemiBold',
    color: '#000000',
    letterSpacing: 0.3,
  },
});