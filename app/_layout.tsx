// app/_layout.tsx
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DreamUsageProvider } from './contexts/DreamUsageContext';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { user, isLoading } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // 🔍 DEBUG LOGS - CHECK THESE IN CONSOLE!
  useEffect(() => {
    console.log('🔍 ============ APP STATE DEBUG ============');
    console.log('🔍 AUTH LOADING:', isLoading);
    console.log('🔍 CHECKING ONBOARDING:', checkingOnboarding);
    console.log('🔍 USER:', user?.id || 'NO USER');
    console.log('🔍 HAS SEEN ONBOARDING:', hasSeenOnboarding);
    console.log('🔍 CURRENT SEGMENTS:', segments);
    console.log('🔍 =========================================');
  }, [isLoading, checkingOnboarding, user, hasSeenOnboarding, segments]);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        console.log('📋 Checking onboarding status...');
        const hasCompleted = await AsyncStorage.getItem('hasCompletedOnboarding');
        console.log('📋 Onboarding completed:', hasCompleted);
        
        setHasSeenOnboarding(hasCompleted === 'true');
        setCheckingOnboarding(false);

        if (hasCompleted !== 'true' && segments[0] !== '(auth)') {
          console.log('➡️ Navigating to welcome screen');
          router.replace('/(auth)/welcome');
        } else if (hasCompleted === 'true' && segments[0] === '(auth)') {
          console.log('➡️ Navigating to tabs');
          router.replace('/(tabs)');
        }
      } catch (error) {
        console.error('❌ Error checking onboarding status:', error);
        setCheckingOnboarding(false);
        router.replace('/(auth)/welcome');
      }
    };
    checkOnboardingStatus();
  }, []);

  useEffect(() => {
    const initializeRevenueCat = async () => {
      try {
        console.log('💰 Initializing RevenueCat...');
        if (Platform.OS === 'android') {
          await Purchases.configure({ apiKey: '***REMOVED***' });
        } else if (Platform.OS === 'ios') {
          await Purchases.configure({ apiKey: 'appl_vRUwRfxjglNcNpuBpAOGxFSKohU' });
        }
        const rcId = user?.id ?? null;
        if (rcId) {
          console.log('💰 Logging into RevenueCat with user:', rcId);
          await Purchases.logIn(rcId);
        }
        if (__DEV__) Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
        console.log('✅ RevenueCat initialized successfully');
      } catch (error) {
        console.error('❌ Error initializing RevenueCat:', error);
      }
    };
    initializeRevenueCat();
  }, [user]);

  if (isLoading || checkingOnboarding) {
    console.log('⏳ SHOWING LOADING SCREEN - isLoading:', isLoading, 'checkingOnboarding:', checkingOnboarding);
    return (
      <LinearGradient colors={['#7C86FF', '#E3C8FF']} style={{ flex: 1 }}>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      </LinearGradient>
    );
  }

  console.log('✅ RENDERING MAIN APP CONTENT');
  return (
    <DreamUsageProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#FFFFFF' },
          animation: 'fade',
        }}
        initialRouteName={hasSeenOnboarding ? '(tabs)' : '(auth)'}
      >
        <Stack.Screen name="(auth)" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="+not-found" />
        <Stack.Screen name="privacy-policy" options={{ title: 'Privacy Policy', presentation: 'modal' }} />
      </Stack>
    </DreamUsageProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (Platform.OS !== 'web') {
      console.log('🔐 Configuring Google Sign In...');
      GoogleSignin.configure({
        webClientId: '967701675568-0dj67qpsco2fr244m0tajvvnnu42c730.apps.googleusercontent.com',
        iosClientId: '967701675568-ipr1qtc009migtvem6nce0poq213ic6q.apps.googleusercontent.com',
        offlineAccess: true,
      });
    }
  }, []);

  useEffect(() => {
    if (loaded) {
      console.log('✅ Fonts loaded, hiding splash screen');
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    console.log('⏳ Waiting for fonts to load...');
    return null;
  }

  console.log('✅ Fonts loaded, rendering AuthProvider');
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}