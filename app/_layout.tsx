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

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { user, isLoading } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // Check if user has completed onboarding
  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const hasCompleted = await AsyncStorage.getItem('hasCompletedOnboarding');
        setHasSeenOnboarding(hasCompleted === 'true');
        setCheckingOnboarding(false);
        
        // Navigate to welcome if first time
        if (hasCompleted !== 'true' && segments[0] !== '(auth)') {
          router.replace('/(auth)/welcome');
        } else if (hasCompleted === 'true' && segments[0] === '(auth)') {
          // If onboarding is complete but we're still in auth, go to home
          router.replace('/(tabs)');
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        setCheckingOnboarding(false);
        // Default to showing onboarding on error
        router.replace('/(auth)/welcome');
      }
    };

    checkOnboardingStatus();
  }, []);

  // Initialize RevenueCat with CORRECT PUBLIC KEY
  useEffect(() => {
    const initializeRevenueCat = async () => {
      try {
        if (Platform.OS === 'android') {
          // Android configuration with PUBLIC KEY (not secret key!)
          await Purchases.configure({
            apiKey: '***REMOVED***' // Your PUBLIC Google SDK key
          });
        } else if (Platform.OS === 'ios') {
          // iOS configuration - add this when you have Apple Developer account
          // await Purchases.configure({
          //   apiKey: 'appl_YOUR_IOS_PUBLIC_KEY' // Will look like appl_xxxxx
          // });
        }

        // Optional: Set user ID if you have one from your auth system
        if (user?.uid) {
          await Purchases.logIn(user.uid);
        }

        // Enable debug logs in development
        if (__DEV__) {
          Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
        }

        console.log('RevenueCat initialized successfully');
      } catch (error) {
        console.error('Error initializing RevenueCat:', error);
      }
    };

    initializeRevenueCat();
  }, [user]);

  // Show loading while checking onboarding status
  if (isLoading || checkingOnboarding) {
    return (
      <LinearGradient colors={['#7C86FF', '#E3C8FF']} style={{ flex: 1 }}>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      </LinearGradient>
    );
  }

  return (
    <DreamUsageProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: 'transparent' },
          animation: 'fade',
        }}
        initialRouteName={hasSeenOnboarding ? "(tabs)" : "(auth)"}
      >
        {/* Show auth screens for onboarding/signin flow */}
        <Stack.Screen 
          name="(auth)" 
          options={{
            animation: 'slide_from_right',
          }}
        />
        
        {/* Main app tabs - accessible after onboarding */}
        <Stack.Screen 
          name="(tabs)" 
          options={{
            animation: 'fade',
          }}
        />
        
        {/* Other screens */}
        <Stack.Screen name="+not-found" />
        <Stack.Screen 
          name="privacy-policy" 
          options={{ 
            title: 'Privacy Policy',
            presentation: 'modal' 
          }} 
        />
      </Stack>
    </DreamUsageProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    // Initialize Google Sign-In
    if (Platform.OS !== 'web') {
      GoogleSignin.configure({
        webClientId: '657368542105-rljuhdohnubivd068c6gclnhlfep06h7.apps.googleusercontent.com',
        offlineAccess: true,
      });
    }
  }, []);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}