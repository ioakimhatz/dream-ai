// app/(auth)/verify-otp.tsx - CODE VERIFICATION
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VerifyOTPScreen() {
  const { email } = useLocalSearchParams();
  const [code, setCode] = useState(['', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputs = useRef<TextInput[]>([]);

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text;
    setCode(newCode);

    // Auto-focus next
    if (text && index < 3) {
      inputs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
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
      // Verify OTP code
      // await verifyOTP(email, fullCode);
      
      // Success - navigate to main app
      router.replace('/(tabs)' as any);
    } catch (error) {
      Alert.alert('Invalid Code', 'Please check your code and try again');
      setCode(['', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
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
          Enter the code we sent to{'\n'}
          <Text style={styles.email}>{email}</Text>
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
          <Text style={styles.verifyingText}>Verifying...</Text>
        )}

        <TouchableOpacity style={styles.resendButton}>
          <Text style={styles.resendText}>
            Didn't get it? <Text style={styles.resendLink}>Send again</Text>
          </Text>
        </TouchableOpacity>
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
  },
  codeInput: {
    width: 70,
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
  verifyingText: {
    fontSize: 15,
    color: '#7278E6',
    textAlign: 'center',
    marginBottom: 20,
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
});