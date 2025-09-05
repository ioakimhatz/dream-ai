// app/(auth)/email-entry.tsx - OTP REQUEST
// ============================================
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EmailEntryScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!email || !email.includes('@')) return;

    setIsLoading(true);
    try {
      // Send OTP to email
      // await sendOTPEmail(email);
      
      router.push({
        pathname: '/(auth)/verify-otp',
        params: { email }
      });
    } catch (error) {
      console.error('Failed to send OTP:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <Text style={styles.title}>Enter your email</Text>
          <Text style={styles.subtitle}>
            We'll send you a code to sign in
          </Text>

          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#86868B"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoFocus={true}
            editable={!isLoading}
          />

          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleSendOTP}
            disabled={!email || isLoading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={email && !isLoading ? ['#7278E6', '#E879F9'] : ['#E5E5E7', '#E5E5E7']}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={[
                styles.buttonText,
                (!email || isLoading) && styles.buttonTextDisabled
              ]}>
                {isLoading ? 'Sending...' : 'Send Code'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  keyboardView: {
    flex: 1,
  },
  backButton: {
    padding: 24,
  },
  backText: {
    fontSize: 28,
    color: '#000',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#000',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    color: '#86868B',
    marginBottom: 40,
  },
  input: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000',
    backgroundColor: '#F5F5F7',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  continueButton: {
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
  buttonTextDisabled: {
    color: '#86868B',
  },
});