// app/(auth)/signup.tsx - WITH CONSISTENT LOGO FROM HOME SCREEN
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
            {/* Logo Section - MATCHING HOME SCREEN EXACTLY */}
            <View style={styles.logoSection}>
              <View style={styles.logoRow}>
                <Image
                  source={require('../../assets/images/logo.png')}
                  style={styles.logoImg}
                />
                <Text style={styles.logoWord}>Dream AI</Text>
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
                  <Text style={styles.iconText}>✉️</Text>
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
                  <Text style={styles.iconText}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
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

              {/* Google Sign Up - SIMPLIFIED FOR NOW */}
              <TouchableOpacity
                style={[styles.googleButton, isLoading && styles.buttonDisabled]}
                onPress={handleGoogleSignUp}
                disabled={isLoading}
              >
                {/* If you have a Google logo asset, replace this with:
                    <Image 
                      source={require('../../assets/images/google-logo.png')} 
                      style={styles.googleLogoImage}
                    />
                */}
                <View style={styles.googleLogoPlaceholder}>
                  <Text style={styles.googleG}>G</Text>
                </View>
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
    paddingTop: 40,
    paddingBottom: 40,
  },

  // ========== LOGO SECTION - MATCHING HOME SCREEN ==========
  logoSection: {
    alignItems: 'center',
    marginBottom: 50,
    paddingTop: 30,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    transform: [{ translateX: -22 }], // Same as home screen
  },
  logoImg: {
    width: 72,
    height: 64,
    resizeMode: 'contain',
    marginRight: 3,
  },
  logoWord: {
    fontSize: 52,
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.5,
    marginLeft: 0,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  tagline: {
    fontSize: 17,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },

  // ========== AUTH CARD ==========
  authCard: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    marginBottom: 30,
  },

  // ========== WELCOME SECTION ==========
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0A2540',
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  welcomeSubtitle: {
    fontSize: 17,
    color: '#68707D',
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 24,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },

  // ========== INPUT STYLES ==========
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    paddingHorizontal: 6,
    height: 56,
  },
  inputIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    fontSize: 17,
    color: '#0A2540',
    paddingVertical: 16,
    paddingHorizontal: 10,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  eyeButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ========== BUTTONS ==========
  primaryButton: {
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 24,
    marginTop: 12,
  },
  primaryButtonGradient: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // ========== DIVIDER ==========
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 15,
    color: '#68707D',
    marginHorizontal: 18,
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },

  // ========== GOOGLE BUTTON ==========
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    paddingVertical: 18,
    marginBottom: 24,
  },
  googleLogoPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  googleG: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  // Use this if you add a Google logo asset:
  googleLogoImage: {
    width: 24,
    height: 24,
    marginRight: 14,
  },
  googleButtonText: {
    fontSize: 17,
    color: '#0A2540',
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },

  // ========== SIGNUP PROMPT ==========
  signupPrompt: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  signupText: {
    fontSize: 17,
    color: '#68707D',
    fontWeight: '500',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  signupLink: {
    fontSize: 17,
    color: '#7278E6',
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },

  // ========== TRIAL INFO SECTION ==========
  trialInfo: {
    backgroundColor: 'rgba(114, 120, 230, 0.1)',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(114, 120, 230, 0.2)',
  },
  trialTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#7278E6',
    textAlign: 'center',
    marginBottom: 14,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  trialFeatures: {
    gap: 6,
  },
  trialFeature: {
    fontSize: 15,
    color: '#68707D',
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },

  // ========== FOOTER ==========
  footer: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 24,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
});