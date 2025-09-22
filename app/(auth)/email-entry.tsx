// app/(auth)/email-entry.tsx - EMAIL ENTRY WITH EMAILJS
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

export default function EmailEntryScreen() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { sendOTP } = useAuth();

  const handleSendOTP = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      // Send OTP using EmailJS through AuthContext
      const success = await sendOTP(email);
      
      if (success) {
        // Navigate to verification screen
        router.push({
          pathname: '/(auth)/verify-otp',
          params: { email }
        });
      } else {
        Alert.alert('Error', 'Failed to send verification code. Please try again.');
      }
    } catch (error) {
      console.error('Failed to send OTP:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
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
            We'll send you a 4-digit code to sign in
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
            style={[
              styles.continueButton,
              (!email || isLoading) && styles.buttonDisabled
            ]}
            onPress={handleSendOTP}
            disabled={!email || isLoading}
            activeOpacity={0.8}
          >
            <Text style={[
              styles.buttonText,
              (!email || isLoading) && styles.buttonTextDisabled
            ]}>
              {isLoading ? 'Sending...' : 'Send Code'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.infoText}>
            Powered by Dream AI's secure email verification
          </Text>
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
    backgroundColor: '#7E78EA', // DREAM AI PURPLE
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#E5E5E7',
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  buttonTextDisabled: {
    color: '#86868B',
  },
  infoText: {
    fontSize: 13,
    color: '#86868B',
    textAlign: 'center',
    marginTop: 20,
  },
});