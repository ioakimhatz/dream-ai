// app/(auth)/auth-select.tsx - WITH APPLE SIGN-IN
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import React from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

export default function AuthSelectScreen() {
  const { signInWithGoogle, isLoading } = useAuth();
  
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  const handleAppleSignIn = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      console.log('Apple Sign-In Success:', {
        user: credential.user,
        email: credential.email,
        fullName: credential.fullName,
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
      });
      
      // Navigate to home after successful sign-in
      router.replace('/(tabs)' as any);
      
    } catch (e: any) {
      if (e.code === 'ERR_CANCELED') {
        console.log('User canceled Apple Sign-In');
      } else {
        console.error('Apple Sign-In failed:', e);
        // Fallback to manual signin
        router.push('/(auth)/signin');
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
      // Navigation handled by auth state change in _layout.tsx
    } catch (error) {
      console.error('Google sign-in failed:', error);
      // Fallback to manual signin
      router.push('/(auth)/signin');
    }
  };

  const handleSkip = () => {
    // Go directly to main app (will be handled by auth check)
    router.replace('/(tabs)' as any);
  };

  const handleBack = () => {
    router.back();
  };

  // Assuming this is the last step after onboarding
  const progress = 100;

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

        {/* Progress Bar - Full */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Save your progress</Text>
        
        <View style={styles.buttonContainer}>
          {/* Apple Sign In - Only show on iOS */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.appleButton, isLoading && styles.buttonDisabled]}
              onPress={handleAppleSignIn}
              activeOpacity={0.9}
              disabled={isLoading}
            >
              <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
              <Text style={styles.appleText}>Sign in with Apple</Text>
            </TouchableOpacity>
          )}

          {/* Google Sign In - Shows on both platforms */}
          <TouchableOpacity
            style={[styles.googleButton, isLoading && styles.buttonDisabled]}
            onPress={handleGoogleSignIn}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            <Image 
              source={require('../../assets/images/google-logo.png')}
              style={styles.googleLogo}
              resizeMode="contain"
            />
            <Text style={styles.googleText}>
              {isLoading ? 'Signing in...' : 'Sign in with Google'}
            </Text>
          </TouchableOpacity>

          {/* Skip Option */}
          <View style={styles.skipContainer}>
            <Text style={styles.skipPrompt}>
              Would you like to sign in later?{' '}
              <Text 
                style={styles.skipLink}
                onPress={handleSkip}
              >
                Skip
              </Text>
            </Text>
          </View>
        </View>
      </View>
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
    backgroundColor: '#7E78EA', // Dream AI purple
    borderRadius: 1.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    marginTop: -60, // Move content up a bit
  },
  title: {
    fontSize: 34,
    fontFamily: 'Inter_700Bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 60,
    letterSpacing: -0.5,
  },
  buttonContainer: {
    alignItems: 'stretch',
  },
  // Apple button - black like Cal AI
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 19,
    borderRadius: 30,
    marginBottom: 16,
  },
  appleText: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    marginLeft: 10,
    letterSpacing: -0.3,
  },
  // Google button - white with border like Cal AI
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    marginBottom: 40,
  },
  googleLogo: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleText: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
    letterSpacing: -0.3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  skipContainer: {
    alignItems: 'center',
  },
  skipPrompt: {
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    textAlign: 'center',
  },
  skipLink: {
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
    textDecorationLine: 'underline',
  },
});