// app/(auth)/welcome.tsx - UPDATED WITH CAL AI LAYOUT
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
    Animated,
    Dimensions,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      {/* Visual Section - Leave space for your Canva creation */}
      <Animated.View style={[
        styles.visualContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}>
        {/* Placeholder for your visual - Replace with your Canva image */}
        <View style={styles.visualPlaceholder}>
          {/* Temporary placeholder - DELETE THIS WHEN YOU ADD YOUR IMAGE */}
          <View style={styles.phoneFrame}>
            <LinearGradient
              colors={['#7C86FF', '#E3C8FF']}
              style={styles.tempGradient}
            >
              <Text style={styles.moonIcon}>🌙</Text>
            </LinearGradient>
            <View style={styles.scannerCorners}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </View>
          <Text style={styles.scanText}>• Speak Your Dream</Text>
        </View>

        {/* When you have your Canva image, use this instead:
        <Image 
          source={require('../../assets/images/dream-visual.png')} 
          style={styles.visualImage}
          resizeMode="contain"
        />
        */}
      </Animated.View>

      {/* Bottom Section with Content */}
      <Animated.View style={[
        styles.bottomSection,
        { opacity: fadeAnim }
      ]}>
        {/* Slogan */}
        <Text style={styles.slogan}>
          Dream recording{'\n'}made magical
        </Text>

        {/* Get Started Button */}
        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={() => router.push('/(auth)/showcase' as any)}
          activeOpacity={0.9}
        >
          <Text style={styles.getStartedText}>Get Started</Text>
        </TouchableOpacity>

        {/* Sign In Link */}
        <Text style={styles.signInPrompt}>
          Already have an account? 
          <Text 
            style={styles.signInLink}
            onPress={() => router.push('/(auth)/signin' as any)}
          >
            {' '}Sign In
          </Text>
        </Text>
      </Animated.View>

      {/* Bottom spacer for home indicator */}
      <View style={styles.bottomSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Visual Section (60% of screen)
  visualContainer: {
    flex: 1.2,
    paddingTop: 60,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Placeholder for visual (DELETE WHEN YOU ADD YOUR IMAGE)
  visualPlaceholder: {
    width: width * 0.8,
    alignItems: 'center',
  },

  phoneFrame: {
    width: width * 0.6,
    height: width * 0.6 * 1.4,
    backgroundColor: '#000',
    borderRadius: 30,
    padding: 3,
    marginBottom: 20,
    position: 'relative',
    overflow: 'hidden',
  },

  tempGradient: {
    flex: 1,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },

  moonIcon: {
    fontSize: 60,
  },

  scannerCorners: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },

  topLeft: {
    top: 20,
    left: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },

  topRight: {
    top: 20,
    right: 20,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },

  bottomLeft: {
    bottom: 20,
    left: 20,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },

  bottomRight: {
    bottom: 20,
    right: 20,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },

  scanText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },

  // When you add your Canva image
  visualImage: {
    width: width * 0.85,
    height: width * 0.85 * 1.2, // Adjust ratio as needed
    maxHeight: height * 0.45,
  },

  // Bottom Section (40% of screen)
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    alignItems: 'center',
  },

  slogan: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 38,
    letterSpacing: -0.5,
  },

  getStartedButton: {
    backgroundColor: '#000',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 24,
  },

  getStartedText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  signInPrompt: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },

  signInLink: {
    color: '#000',
    fontWeight: '700',
  },

  bottomSpacer: {
    height: 34, // For iPhone home indicator
  },
});