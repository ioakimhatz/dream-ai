// app/(auth)/auth-select.tsx - FIXED: AuthContext handles navigation
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

export default function AuthSelectScreen() {
  const { signInWithGoogle, signInWithApple, isLoading } = useAuth();

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) return null;

  const handleAppleSignIn = async () => {
    try {
      await signInWithApple(); // AuthContext handles everything
      // ✅ Success - already navigated
    } catch (e) {
      console.error('Apple Sign-In failed:', e);
      // ✅ User stays on auth-select screen
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle(); // AuthContext handles everything
      // ✅ Success - already navigated
    } catch (error) {
      console.error('Google sign-in failed:', error);
      // ✅ User stays on auth-select screen
    }
  };

  const progress = 100;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {/* Progress bar only - NO BACK BUTTON */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>Save your progress</Text>
        <Text style={styles.subtitle}>Sign in to continue using Dream AI</Text>
        
        <View style={styles.buttonContainer}>
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
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingTop: 10, paddingBottom: 20 },
  progressContainer: { flex: 1 },
  progressBar: { height: 3, backgroundColor: '#F0F0F0', borderRadius: 1.5, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#7E78EA', borderRadius: 1.5 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', marginTop: -60 },
  title: { fontSize: 34, fontFamily: 'Inter_700Bold', color: '#000', textAlign: 'center', marginBottom: 12, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, fontFamily: 'Inter_400Regular', color: '#666', textAlign: 'center', marginBottom: 48 },
  buttonContainer: { alignItems: 'stretch' },
  appleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000', paddingVertical: 19, borderRadius: 30, marginBottom: 16 },
  appleText: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: '#FFFFFF', marginLeft: 10, letterSpacing: -0.3 },
  googleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', paddingVertical: 18, borderRadius: 30, borderWidth: 2, borderColor: '#E5E5E5' },
  googleLogo: { width: 20, height: 20, marginRight: 10 },
  googleText: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: '#000', letterSpacing: -0.3 },
  buttonDisabled: { opacity: 0.6 },
});