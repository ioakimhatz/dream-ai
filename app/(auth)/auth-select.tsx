// app/(auth)/auth-select.tsx - SIGN UP OPTIONS
import { router } from 'expo-router';
import React from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

export default function AuthSelectScreen() {
  const { signInWithGoogle, signInWithApple } = useAuth();

  const handleGoogleAuth = async () => {
    try {
      await signInWithGoogle();
      // Auth context handles navigation
    } catch (error) {
      console.error('Google auth failed:', error);
    }
  };

  const handleAppleAuth = async () => {
    try {
      // Check if signInWithApple exists (it's optional)
      if (signInWithApple) {
        await signInWithApple();
      }
      // Auth context handles navigation
    } catch (error) {
      console.error('Apple auth failed:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>
          Start turning your dreams into cinematic reality
        </Text>

        <View style={styles.authButtons}>
          {/* Google Sign In */}
          <TouchableOpacity
            style={styles.authButton}
            onPress={handleGoogleAuth}
            activeOpacity={0.8}
          >
            {/* Add your Google logo here */}
            <Text style={styles.googleG}>G</Text>
            <Text style={styles.authButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Apple Sign In - iOS only */}
          {Platform.OS === 'ios' && signInWithApple && (
            <TouchableOpacity
              style={[styles.authButton, styles.appleButton]}
              onPress={handleAppleAuth}
              activeOpacity={0.8}
            >
              <Text style={styles.appleLogo}></Text>
              <Text style={[styles.authButtonText, styles.appleText]}>
                Continue with Apple
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Optional: Email sign in */}
        <TouchableOpacity 
          onPress={() => router.push('/(auth)/email-entry' as any)}
          style={styles.emailOption}
        >
          <Text style={styles.emailText}>or continue with email</Text>
        </TouchableOpacity>

        <Text style={styles.terms}>
          By continuing, you agree to our{'\n'}
          <Text style={styles.link}>Terms</Text> and{' '}
          <Text style={styles.link}>Privacy Policy</Text>
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: '#86868B',
    marginBottom: 50,
    textAlign: 'center',
  },
  authButtons: {
    width: '100%',
    gap: 16,
  },
  authButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F7',
    paddingVertical: 18,
    borderRadius: 14,
    gap: 12,
  },
  appleButton: {
    backgroundColor: '#000',
  },
  googleG: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  appleLogo: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  authButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
  appleText: {
    color: '#FFFFFF',
  },
  emailOption: {
    marginTop: 30,
  },
  emailText: {
    fontSize: 15,
    color: '#7278E6',
    fontWeight: '600',
  },
  terms: {
    fontSize: 13,
    color: '#86868B',
    textAlign: 'center',
    marginTop: 'auto',
    marginBottom: 40,
    lineHeight: 18,
  },
  link: {
    color: '#7278E6',
    textDecorationLine: 'underline',
  },
});