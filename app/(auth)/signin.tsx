// app/(auth)/signin.tsx - X BUTTON POPS BACK WITHOUT REMOUNTING
import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
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

export default function SignInScreen() {
  const { signInWithGoogle, signInWithApple, isLoading } = useAuth();

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
      await signInWithApple();
    } catch (e: any) {
      console.error('Apple Sign-In failed:', e);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error('Google sign-in failed:', error);
    }
  };

  const handleEmailSignIn = () => {
    router.push('/email-entry');
  };

  // ✅ Close button: pop if possible (no remount), otherwise hard-navigate
  const handleClose = () => {
    if (router.canGoBack()) {
      router.back(); // pops to existing /welcome instance without remount
    } else {
      router.replace('/welcome'); // fallback for deep links / cold starts
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with X button */}
      <View style={styles.header}>
        <Text style={styles.title}>Sign In</Text>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Close and go back"
        >
          <Ionicons name="close" size={28} color="#000" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
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

          {/* Google Sign In */}
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

          {/* Email Sign In */}
          <TouchableOpacity
            style={[styles.emailButton, isLoading && styles.buttonDisabled]}
            onPress={handleEmailSignIn}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            <Ionicons name="mail-outline" size={20} color="#000" />
            <Text style={styles.emailText}>Continue with email</Text>
          </TouchableOpacity>
        </View>

        {/* Terms and Privacy */}
        <Text style={styles.terms}>
          By continuing you agree to Dream AI's{'\n'}
          <Text style={styles.termsLink}>Terms and Conditions</Text> and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
    position: 'relative',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_700Bold',
    color: '#000',
    letterSpacing: -0.5,
  },
  closeButton: {
    position: 'absolute',
    right: 24,
    top: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    marginTop: -60,
  },
  buttonContainer: {
    marginBottom: 40,
  },
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
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    marginBottom: 16,
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
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  emailText: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: '#000',
    marginLeft: 10,
    letterSpacing: -0.3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  terms: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  termsLink: {
    textDecorationLine: 'underline',
    color: '#000',
  },
});
