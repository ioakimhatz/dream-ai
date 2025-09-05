// app/(auth)/signin.tsx - RETURNING USER
// ============================================
import { router } from 'expo-router';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SignInScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity 
        style={styles.closeButton}
        onPress={() => router.back()}
      >
        <Text style={styles.closeText}>×</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Sign in to continue your dream journey
        </Text>

        <TouchableOpacity
          style={styles.emailButton}
          onPress={() => router.push('/(auth)/email-entry' as any)}
        >
          <Text style={styles.emailButtonText}>Sign in with email</Text>
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
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 32,
    color: '#86868B',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 120,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 17,
    color: '#86868B',
    marginBottom: 50,
    textAlign: 'center',
  },
  emailButton: {
    backgroundColor: '#F5F5F7',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  emailButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#000',
  },
});