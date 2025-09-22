// app/contexts/AuthContext.tsx - WITH EMAILJS INTEGRATION AND APPLE SIGN-IN FIXED
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { EmailService } from '../../lib/emailjs-service';

interface User {
  id: string;
  email: string;
  name: string;
  photo?: string | null;
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
  tempEmail: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithApple?: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  
  // OTP Methods
  sendOTP: (email: string) => Promise<boolean>;
  verifyOTP: (code: string) => Promise<boolean>;
  resendOTP: () => Promise<boolean>;
  
  // Dream tracking methods
  useDream: () => Promise<boolean>;
  canGenerateDream: () => boolean;
  getDreamsRemaining: () => number;
  updateSubscription: (planId: string, dreamsPerMonth: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tempEmail, setTempEmail] = useState<string | null>(null);
  const [tempOTP, setTempOTP] = useState<string | null>(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  useEffect(() => {
    if (user?.dreamUsage) {
      checkMonthlyReset();
    }
  }, [user]);

  const checkAuthState = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('user');
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        
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
      const updatedUser = {
        ...user,
        dreamUsage: {
          ...user.dreamUsage,
          used: 0,
          resetDate: now + (30 * 24 * 60 * 60 * 1000)
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

  // Send 4-digit OTP to email using EmailJS
  const sendOTP = async (email: string): Promise<boolean> => {
    try {
      // Use EmailJS to send OTP
      const result = await EmailService.sendOTP(email);
      
      if (result.success && result.otp) {
        // Store OTP locally for verification
        await AsyncStorage.setItem('temp_otp', result.otp);
        await AsyncStorage.setItem('temp_otp_email', email);
        await AsyncStorage.setItem('temp_otp_expires', (Date.now() + 10 * 60 * 1000).toString());
        
        setTempEmail(email);
        setTempOTP(result.otp);
        
        // In dev mode, show the OTP for testing
        if (__DEV__) {
          Alert.alert('Dev Mode', `Your 4-digit code is: ${result.otp}`);
        }
        
        return true;
      }
      
      throw new Error(result.error || 'Failed to send OTP');
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      Alert.alert('Error', 'Failed to send verification code. Please try again.');
      return false;
    }
  };

  // Verify 4-digit OTP code
  const verifyOTP = async (code: string): Promise<boolean> => {
    try {
      if (!tempEmail) {
        Alert.alert('Error', 'No email address found');
        return false;
      }

      // Get stored OTP data
      const storedOTP = await AsyncStorage.getItem('temp_otp');
      const storedEmail = await AsyncStorage.getItem('temp_otp_email');
      const storedExpires = await AsyncStorage.getItem('temp_otp_expires');
      
      // Check if OTP expired
      if (storedExpires && Date.now() > parseInt(storedExpires)) {
        await AsyncStorage.multiRemove(['temp_otp', 'temp_otp_email', 'temp_otp_expires']);
        Alert.alert('Error', 'Verification code has expired. Please request a new one.');
        return false;
      }
      
      // Verify OTP
      if (storedEmail !== tempEmail || storedOTP !== code) {
        Alert.alert('Error', 'Invalid verification code');
        return false;
      }
      
      // Clean up temp storage
      await AsyncStorage.multiRemove(['temp_otp', 'temp_otp_email', 'temp_otp_expires']);

      // OTP is valid - create user session
      const userData: User = {
        id: `email_${Date.now()}`,
        email: tempEmail,
        name: tempEmail.split('@')[0],
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
      setTempEmail(null);
      setTempOTP(null);
      
      Alert.alert('Success!', 'Signed in successfully');
      return true;
    } catch (error) {
      console.error('Error verifying OTP:', error);
      Alert.alert('Error', 'Verification failed. Please try again.');
      return false;
    }
  };

  // Resend OTP
  const resendOTP = async (): Promise<boolean> => {
    if (!tempEmail) return false;
    return sendOTP(tempEmail);
  };

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      
      await GoogleSignin.hasPlayServices();
      const response: any = await GoogleSignin.signIn();
      
      const userData: User = {
        id: response.user?.id || response.id || 'google_user',
        email: response.user?.email || response.email,
        name: response.user?.name || response.name || 'User',
        photo: response.user?.photo || response.photo || null,
        dreamUsage: {
          used: 0,
          total: 0,
          resetDate: Date.now() + (30 * 24 * 60 * 60 * 1000),
          planId: 'free'
        }
      };
      
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

  // THIS IS THE FIXED APPLE SIGN-IN FUNCTION
  const signInWithApple = async () => {
    try {
      setIsLoading(true);
      
      if (Platform.OS === 'ios') {
        // Actually perform Apple Sign-In (not just show "Coming Soon")
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        // Build the user name from Apple's response
        let userName = 'User';
        if (credential.fullName) {
          const { givenName, familyName } = credential.fullName;
          if (givenName || familyName) {
            userName = [givenName, familyName].filter(Boolean).join(' ');
          }
        }
        
        // If no name from Apple and we have email, use email prefix
        if (userName === 'User' && credential.email) {
          userName = credential.email.split('@')[0];
        }

        // Create user object with Apple data
        const userData: User = {
          id: credential.user, // Apple's unique user ID
          email: credential.email || `${credential.user}@privaterelay.appleid.com`,
          name: userName,
          photo: null,
          dreamUsage: {
            used: 0,
            total: 0,
            resetDate: Date.now() + (30 * 24 * 60 * 60 * 1000),
            planId: 'free'
          }
        };
        
        // Save user to AsyncStorage
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
        
        Alert.alert('Success!', `Welcome ${userData.name}!`);
        router.replace('/(tabs)');
        
      } else {
        Alert.alert(
          'Not Available',
          'Apple Sign In is only available on iOS devices.'
        );
      }
      
    } catch (error: any) {
      if (error.code === 'ERR_CANCELED') {
        console.log('User canceled Apple Sign-In');
      } else {
        console.error('Apple Sign-In Error:', error);
        Alert.alert('Sign In Failed', 'Please try Google Sign In instead');
      }
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
      
      try {
        await GoogleSignin.signOut();
      } catch (error) {
        console.log('Google sign out skipped');
      }
      
      await AsyncStorage.removeItem('user');
      setUser(null);
      
      // Navigate to welcome instead of signin
      router.replace('/(auth)/welcome');
      
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Dream tracking methods
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
        used: 0,
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
        tempEmail,
        signInWithGoogle,
        signInWithApple: Platform.OS === 'ios' ? signInWithApple : undefined,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        sendOTP,
        verifyOTP,
        resendOTP,
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

export default function AuthContextProvider({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}