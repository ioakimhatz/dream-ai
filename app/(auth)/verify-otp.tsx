// app/(auth)/verify-otp.tsx - CLEAN PRODUCTION VERSION
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';

export default function VerifyOTPScreen() {
  const { email } = useLocalSearchParams();
  const [code, setCode] = useState(['', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const inputs = useRef<TextInput[]>([]);
  
  const { verifyOTP, resendOTP, tempEmail } = useAuth();

  useEffect(() => {
    const timer = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    
    if (text.length > 1) {
      const pastedCode = text.slice(0, 4).split('');
      for (let i = 0; i < pastedCode.length && i < 4; i++) {
        newCode[i] = pastedCode[i];
      }
      setCode(newCode);
      
      const lastIndex = Math.min(pastedCode.length - 1, 3);
      inputs.current[lastIndex]?.focus();
      
      if (pastedCode.length === 4) {
        verifyCode(newCode.join(''));
      }
      return;
    }
    
    newCode[index] = text;
    setCode(newCode);

    if (text && index < 3) {
      inputs.current[index + 1]?.focus();
    }

    if (index === 3 && text) {
      const fullCode = newCode.join('');
      if (fullCode.length === 4) {
        verifyCode(fullCode);
      }
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const verifyCode = async (fullCode: string) => {
    setIsVerifying(true);
    try {
      const success = await verifyOTP(fullCode);
      
      if (success) {
        router.replace('/(tabs)' as any);
      } else {
        Alert.alert('Invalid Code', 'Please check your code and try again');
        setCode(['', '', '', '']);
        inputs.current[0]?.focus();
      }
    } catch (error) {
      Alert.alert('Invalid Code', 'Please check your code and try again');
      setCode(['', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    if (resendTimer > 0) return;
    
    try {
      const success = await resendOTP();
      if (success) {
        setResendTimer(60);
        Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to resend code. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backText}>←</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          Enter the 4-digit code we sent to{'\n'}
          <Text style={styles.email}>{tempEmail || email}</Text>
        </Text>

        <View style={styles.codeContainer}>
          {[0, 1, 2, 3].map((index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                if (ref) inputs.current[index] = ref;
              }}
              style={[
                styles.codeInput,
                code[index] && styles.codeInputFilled
              ]}
              value={code[index]}
              onChangeText={(text) => handleCodeChange(text, index)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={1}
              autoFocus={index === 0}
              selectTextOnFocus
              editable={!isVerifying}
            />
          ))}
        </View>

        {isVerifying && (
          <View style={styles.verifyingContainer}>
            <ActivityIndicator size="small" color="#7278E6" />
            <Text style={styles.verifyingText}>Verifying...</Text>
          </View>
        )}

        <TouchableOpacity 
          style={styles.resendButton}
          onPress={handleResendOTP}
          disabled={resendTimer > 0}
        >
          <Text style={styles.resendText}>
            Didn't get it? {' '}
            <Text style={[styles.resendLink, resendTimer > 0 && styles.resendLinkDisabled]}>
              {resendTimer > 0 ? `Send again in ${resendTimer}s` : 'Send again'}
            </Text>
          </Text>
        </TouchableOpacity>

        {/* 🔥 REMOVED ``HINT */}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    marginBottom: 8,
  },
  email: {
    color: '#000',
    fontWeight: '600',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  codeInput: {
    width: 65,
    height: 70,
    backgroundColor: '#F5F5F7',
    borderRadius: 16,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#000',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  codeInputFilled: {
    borderColor: '#7278E6',
    backgroundColor: '#F8F5FF',
  },
  verifyingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  verifyingText: {
    fontSize: 15,
    color: '#7278E6',
    marginLeft: 8,
  },
  resendButton: {
    alignItems: 'center',
  },
  resendText: {
    fontSize: 15,
    color: '#86868B',
  },
  resendLink: {
    color: '#7278E6',
    fontWeight: '600',
  },
  resendLinkDisabled: {
    opacity: 0.6,
  },
});