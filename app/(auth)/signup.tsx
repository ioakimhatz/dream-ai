// app/(auth)/signup.tsx - WITH ACTUAL LOGO
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

export default function SignUpScreen() {
  const { signUpWithEmail, signInWithGoogle, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleEmailSignUp = async () => {
    // Validation
    if (!name.trim()) {
      Alert.alert('Missing Information', 'Please enter your name.');
      return;
    }
    
    if (!email.trim()) {
      Alert.alert('Missing Information', 'Please enter your email.');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match. Please try again.');
      return;
    }

    try {
      await signUpWithEmail(email.trim(), password, name.trim());
      // Navigation handled by auth state change
    } catch (error) {
      // Error handling done in AuthContext
    }
  };

  const handleGoogleSignUp = async () => {
    try {
      await signInWithGoogle();
      // Navigation handled by auth state change
    } catch (error) {
      // Error handling done in AuthContext
    }
  };

  return (
    <LinearGradient colors={['#7C86FF', '#E3C8FF']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo Section - USING ACTUAL LOGO */}
            <View style={styles.logoSection}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../assets/images/logo.png')} 
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <Text style={styles.logoText}>Dream AI</Text>
              </View>
              <Text style={styles.tagline}>Create your account to start dreaming</Text>
            </View>

            {/* Create Account Card */}
            <View style={styles.authCard}>
              <Text style={styles.welcomeTitle}>Create Account</Text>
              <Text style={styles.welcomeSubtitle}>Join thousands of dreamers creating cinematic videos</Text>

              {/* Name Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputIcon}>
                  <Text style={styles.iconText}>👤</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your name"
                  placeholderTextColor="#9CA3AF"
                  value={name}
                  onChangeText={setName}
                  autoComplete="name"
                  autoCapitalize="words"
                />
              </View>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputIcon}>
                  <Text style={styles.iconText}>✉</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter your email"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputIcon}>
                  <Text style={styles.iconText}>🔒</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="Create password (6+ characters)"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '👁' : '👁‍🗨'}</Text>
                </TouchableOpacity>
              </View>

              {/* Confirm Password Input */}
              <View style={styles.inputContainer}>
                <View style={styles.inputIcon}>
                  <Text style={styles.iconText}>🔒</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="Confirm your password"
                  placeholderTextColor="#9CA3AF"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                />
              </View>

              {/* Create Account Button */}
              <TouchableOpacity
                style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
                onPress={handleEmailSignUp}
                disabled={isLoading}
              >
                <LinearGradient
                  colors={['#7278E6', '#E879F9']}
                  style={styles.primaryButtonGradient}
                >
                  <Text style={styles.primaryButtonText}>
                    {isLoading ? 'Creating Account...' : 'Create Account'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Google Sign Up */}
              <TouchableOpacity
                style={[styles.googleButton, isLoading && styles.buttonDisabled]}
                onPress={handleGoogleSignUp}
                disabled={isLoading}
              >
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>

              {/* Sign In Link */}
              <View style={styles.signupPrompt}>
                <Text style={styles.signupText}>Already have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/signin')}>
                  <Text style={styles.signupLink}>Sign In</Text>
                </TouchableOpacity>
              </View>

              {/* Trial Info */}
              <View style={styles.trialInfo}>
                <Text style={styles.trialTitle}>🎁 3-Day Free Trial Included</Text>
                <View style={styles.trialFeatures}>
                  <Text style={styles.trialFeature}>• 1 free dream to test quality</Text>
                  <Text style={styles.trialFeature}>• Full HD video generation</Text>
                  <Text style={styles.trialFeature}>• Cancel anytime</Text>
                </View>
              </View>
            </View>

            {/* Footer */}
            <Text style={styles.footer}>
              By creating an account, you agree to our Terms of Service and Privacy Policy
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },

  // ========== LOGO SECTION - WITH ACTUAL IMAGE ==========
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
    paddingTop: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  logoImage: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  logoText: {
    fontSize: 52,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    fontWeight: '500',
  },

  // ========== AUTH CARD ==========
  authCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 24,
  },

  // ========== WELCOME SECTION ==========
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0A2540',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#68707D',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },

  // ========== INPUT STYLES ==========
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  inputIcon: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 18,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#0A2540',
    paddingVertical: 14,
    paddingHorizontal: 8,
    fontWeight: '600',
  },
  eyeButton: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    fontSize: 18,
  },

  // ========== BUTTONS ==========
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    marginTop: 8,
  },
  primaryButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // ========== DIVIDER ==========
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 14,
    color: '#68707D',
    marginHorizontal: 16,
    fontWeight: '500',
  },

  // ========== GOOGLE BUTTON ==========
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingVertical: 16,
    marginBottom: 20,
  },
  googleIcon: {
    fontSize: 18,
    marginRight: 12,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 16,
    color: '#0A2540',
    fontWeight: '700',
  },

  // ========== SIGNUP PROMPT ==========
  signupPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  signupText: {
    fontSize: 16,
    color: '#68707D',
    fontWeight: '500',
  },
  signupLink: {
    fontSize: 16,
    color: '#7278E6',
    fontWeight: '800',
  },

  // ========== TRIAL INFO SECTION ==========
  trialInfo: {
    backgroundColor: 'rgba(114, 120, 230, 0.1)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(114, 120, 230, 0.2)',
  },
  trialTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#7278E6',
    textAlign: 'center',
    marginBottom: 12,
  },
  trialFeatures: {
    gap: 4,
  },
  trialFeature: {
    fontSize: 14,
    color: '#68707D',
    fontWeight: '600',
  },

  // ========== FOOTER ==========
  footer: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 20,
  },
});