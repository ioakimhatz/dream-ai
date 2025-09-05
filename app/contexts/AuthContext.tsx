// app/contexts/AuthContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { router } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';

interface User {
  id: string;
  email: string;
  name: string;
  photo?: string | null;
  // Add dream tracking to user
  dreamUsage?: {
    used: number;
    total: number;
    resetDate: number;
    planId: 'free' | 'basic' | 'pro' | 'annual';
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithApple?: () => Promise<void>; // Optional for Android
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  
  // New dream tracking methods
  useDream: () => Promise<boolean>;
  canGenerateDream: () => boolean;
  getDreamsRemaining: () => number;
  updateSubscription: (planId: string, dreamsPerMonth: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  useEffect(() => {
    // Check for monthly reset
    if (user?.dreamUsage) {
      checkMonthlyReset();
    }
  }, [user]);

  const checkAuthState = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        
        // Add default dream usage if missing (for existing users)
        if (!parsedUser.dreamUsage) {
          parsedUser.dreamUsage = {
            used: 0,
            total: 0,
            resetDate: Date.now() + (30 * 24 * 60 * 60 * 1000),
            planId: 'free'
          };
        }
        
        setUser(parsedUser);
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkMonthlyReset = async () => {
    if (!user?.dreamUsage) return;
    
    const now = Date.now();
    if (now > user.dreamUsage.resetDate) {
      // Time to reset monthly dreams
      const updatedUser = {
        ...user,
        dreamUsage: {
          ...user.dreamUsage,
          used: 0, // Reset usage
          resetDate: now + (30 * 24 * 60 * 60 * 1000) // Next month
        }
      };
      
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      
      if (user.dreamUsage.total > 0) {
        Alert.alert(
          'Dreams Refreshed!',
          `Your ${user.dreamUsage.total} monthly dreams have been reset.`
        );
      }
    }
  };

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      
      // Check Google Play Services
      await GoogleSignin.hasPlayServices();
      
      // Sign in with Google - use type assertion since the types are wrong
      const response: any = await GoogleSignin.signIn();
      
      // The response contains user data
      const userData: User = {
        id: response.user?.id || response.id || 'google_user',
        email: response.user?.email || response.email,
        name: response.user?.name || response.name || 'User',
        photo: response.user?.photo || response.photo || null,
        // Initialize dream usage for new users
        dreamUsage: {
          used: 0,
          total: 0,
          resetDate: Date.now() + (30 * 24 * 60 * 60 * 1000),
          planId: 'free'
        }
      };
      
      // Save locally
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      Alert.alert('Success!', `Welcome ${userData.name}!`);
      router.replace('/(tabs)');
      
    } catch (error: any) {
      console.error('Google Sign-In Error:', error);
      Alert.alert('Sign In Failed', error.message || 'Please try again');
    } finally {
      setIsLoading(false);
    }
  };

  // Apple Sign-In - Placeholder for now
  const signInWithApple = async () => {
    try {
      setIsLoading(true);
      
      if (Platform.OS === 'ios') {
        // For iOS, you would implement actual Apple Sign-In here later
        // For now, show coming soon message
        Alert.alert(
          'Coming Soon',
          'Apple Sign In will be available in the next update. Please use Google Sign In for now.'
        );
      } else {
        // Android doesn't support Apple Sign-In
        Alert.alert(
          'Not Available',
          'Apple Sign In is only available on iOS devices.'
        );
      }
      
    } catch (error) {
      console.error('Apple Sign-In Error:', error);
      Alert.alert('Sign In Failed', 'Please try Google Sign In instead');
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      
      const userData: User = {
        id: `local_${Date.now()}`,
        email: email,
        name: email.split('@')[0],
        photo: null,
        dreamUsage: {
          used: 0,
          total: 0,
          resetDate: Date.now() + (30 * 24 * 60 * 60 * 1000),
          planId: 'free'
        }
      };
      
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      Alert.alert('Success!', 'Signed in successfully');
      router.replace('/(tabs)');
      
    } catch (error) {
      Alert.alert('Error', 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    try {
      setIsLoading(true);
      
      const userData: User = {
        id: `local_${Date.now()}`,
        email: email,
        name: name,
        photo: null,
        dreamUsage: {
          used: 0,
          total: 0,
          resetDate: Date.now() + (30 * 24 * 60 * 60 * 1000),
          planId: 'free'
        }
      };
      
      await AsyncStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      Alert.alert('Success!', 'Account created successfully');
      router.replace('/(tabs)');
      
    } catch (error) {
      Alert.alert('Error', 'Sign up failed');
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      
      // Sign out from Google
      try {
        await GoogleSignin.signOut();
      } catch (error) {
        console.log('Google sign out skipped');
      }
      
      // Clear local storage
      await AsyncStorage.removeItem('user');
      setUser(null);
      
      router.replace('/(auth)/signin');
      
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // === NEW DREAM TRACKING METHODS ===
  
  const useDream = async (): Promise<boolean> => {
    if (!user?.dreamUsage || !canGenerateDream()) {
      return false;
    }
    
    const updatedUser = {
      ...user,
      dreamUsage: {
        ...user.dreamUsage,
        used: user.dreamUsage.used + 1
      }
    };
    
    setUser(updatedUser);
    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    
    console.log(`Dream used: ${updatedUser.dreamUsage.used}/${updatedUser.dreamUsage.total}`);
    return true;
  };
  
  const canGenerateDream = (): boolean => {
    if (!user?.dreamUsage) return false;
    return user.dreamUsage.used < user.dreamUsage.total;
  };
  
  const getDreamsRemaining = (): number => {
    if (!user?.dreamUsage) return 0;
    return Math.max(0, user.dreamUsage.total - user.dreamUsage.used);
  };
  
  const updateSubscription = async (planId: string, dreamsPerMonth: number) => {
    if (!user) return;
    
    const updatedUser = {
      ...user,
      dreamUsage: {
        used: 0, // Reset usage on new subscription
        total: dreamsPerMonth,
        resetDate: Date.now() + (30 * 24 * 60 * 60 * 1000),
        planId: planId as 'free' | 'basic' | 'pro' | 'annual'
      }
    };
    
    setUser(updatedUser);
    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signInWithGoogle,
        signInWithApple: Platform.OS === 'ios' ? signInWithApple : undefined,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        useDream,
        canGenerateDream,
        getDreamsRemaining,
        updateSubscription
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// Export as default for Expo Router
export default function AuthContextProvider({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}