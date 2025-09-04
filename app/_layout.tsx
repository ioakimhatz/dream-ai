// app/_layout.tsx - UPDATED WITH DREAM USAGE PROVIDER
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useFonts } from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DreamUsageProvider } from './contexts/DreamUsageContext';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <LinearGradient colors={['#7C86FF', '#E3C8FF']} style={{ flex: 1 }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      </LinearGradient>
    );
  }

  if (!user) {
    return (
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack>
    );
  }

  // User is authenticated, wrap with DreamUsageProvider for subscription features
  return (
    <DreamUsageProvider>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
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