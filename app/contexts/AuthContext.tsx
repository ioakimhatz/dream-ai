// app/contexts/AuthContext.tsx - FIXED: Smart Apple name + Re-throws errors
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { EmailService } from '../../lib/emailjs-service';

export type PlanId = 'free' | 'basic' | 'pro' | 'annual';

export interface SubscriptionInfo {
  plan: string;
  isActive: boolean;
  renewalDate?: Date;
  dreamsRemaining: number;
  totalDreams: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  photo?: string | null;
  dreamUsage?: {
    used: number;
    total: number;
    resetDate: number;
    planId: PlanId;
  };
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  tempEmail: string | null;

  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;

  sendOTP: (email: string) => Promise<boolean>;
  verifyOTP: (code: string) => Promise<boolean>;
  resendOTP: () => Promise<boolean>;

  useDream: () => Promise<boolean>;
  canGenerateDream: () => boolean;
  getDreamsRemaining: () => number;
  updateSubscription: (subscriptionInfo: SubscriptionInfo) => Promise<void>;
  updateUserName: (newName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tempEmail, setTempEmail] = useState<string | null>(null);
  const [tempOTP, setTempOTP] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('user');
        if (saved) {
          const parsed: User = JSON.parse(saved);
          if (!parsed.dreamUsage) {
            parsed.dreamUsage = {
              used: 0,
              total: 0,
              resetDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
              planId: 'free',
            };
          }
          setUser(parsed);
        }
      } catch (e) {
        console.error('Auth rehydrate error:', e);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (user?.dreamUsage) checkMonthlyReset();
  }, [user?.dreamUsage?.resetDate]);

  const checkMonthlyReset = async () => {
    if (!user?.dreamUsage) return;
    const now = Date.now();
    if (now > user.dreamUsage.resetDate) {
      const updated: User = {
        ...user,
        dreamUsage: {
          ...user.dreamUsage,
          used: 0,
          resetDate: now + 30 * 24 * 60 * 60 * 1000,
        },
      };
      setUser(updated);
      await AsyncStorage.setItem('user', JSON.stringify(updated));
      if (user.dreamUsage.total > 0) {
        Alert.alert('Dreams Refreshed!', `Your ${user.dreamUsage.total} monthly dreams have been reset.`);
      }
    }
  };

  const sendOTP = async (email: string): Promise<boolean> => {
    try {
      const result = await EmailService.sendOTP(email);
      if (result.success && result.otp) {
        await AsyncStorage.multiSet([
          ['temp_otp', result.otp],
          ['temp_otp_email', email],
          ['temp_otp_expires', String(Date.now() + 10 * 60 * 1000)],
        ]);
        setTempEmail(email);
        setTempOTP(result.otp);
        return true;
      }
      throw new Error(result.error || 'Failed to send OTP');
    } catch (e) {
      console.error('sendOTP error:', e);
      Alert.alert('Error', 'Failed to send verification code. Please try again.');
      return false;
    }
  };

  const verifyOTP = async (code: string): Promise<boolean> => {
    try {
      if (!tempEmail) {
        Alert.alert('Error', 'No email address found');
        return false;
      }
      const [storedOTP, storedEmail, storedExpires] = await AsyncStorage.multiGet([
        'temp_otp',
        'temp_otp_email',
        'temp_otp_expires',
      ]).then((pairs) => pairs.map(([, v]) => v));

      if (storedExpires && Date.now() > parseInt(storedExpires, 10)) {
        await AsyncStorage.multiRemove(['temp_otp', 'temp_otp_email', 'temp_otp_expires']);
        Alert.alert('Error', 'Verification code has expired. Please request a new one.');
        return false;
      }
      if (storedEmail !== tempEmail || storedOTP !== code) {
        Alert.alert('Error', 'Invalid verification code');
        return false;
      }

      await AsyncStorage.multiRemove(['temp_otp', 'temp_otp_email', 'temp_otp_expires']);

      const userData: User = {
        id: `email_${Date.now()}`,
        email: tempEmail,
        name: tempEmail.split('@')[0],
        photo: null,
        dreamUsage: {
          used: 0,
          total: 0,
          resetDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
          planId: 'free',
        },
      };

      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      setUser(userData);
      setTempEmail(null);
      setTempOTP(null);

      return true;
    } catch (e) {
      console.error('verifyOTP error:', e);
      Alert.alert('Error', 'Verification failed. Please try again.');
      return false;
    }
  };

  const resendOTP = async (): Promise<boolean> => {
    if (!tempEmail) return false;
    return sendOTP(tempEmail);
  };

  const signInWithGoogle = async () => {
    try {
      setIsLoading(true);
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response: any = await GoogleSignin.signIn();

      const userData: User = {
        id: response?.user?.id || response?.id || `google_${Date.now()}`,
        email: response?.user?.email || response?.email || '',
        name: response?.user?.name || response?.name || 'User',
        photo: response?.user?.photo || response?.photo || null,
        dreamUsage: {
          used: 0,
          total: 0,
          resetDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
          planId: 'free',
        },
      };

      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      setUser(userData);

      router.replace('/');
    } catch (e: any) {
      console.error('Google Sign-In Error:', e);
      
      if (e?.code === 'USER_CANCELED' || e?.code === '-5' || e?.message?.includes('cancel')) {
        console.log('User canceled Google Sign-In');
        throw new Error('SIGN_IN_CANCELLED');
      }
      
      Alert.alert('Sign In Failed', e?.message || 'Please try again');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithApple = async () => {
    try {
      setIsLoading(true);

      if (Platform.OS !== 'ios') {
        Alert.alert('Not Available', 'Sign in with Apple is only available on iOS devices.');
        throw new Error('PLATFORM_NOT_SUPPORTED');
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // 🔥 FIXED: Smart name extraction for Apple Sign-In
      let name = 'Apple User'; // Default fallback
      
      // Try to get full name from Apple
      if (credential.fullName) {
        const { givenName, familyName } = credential.fullName;
        const built = [givenName, familyName].filter(Boolean).join(' ').trim();
        if (built) {
          name = built;
        }
      }
      
      // 🔥 NEW: Only use email prefix if it's a REAL name, not an ugly Apple ID
      if (name === 'Apple User' && credential.email) {
        const emailPrefix = credential.email.split('@')[0];
        
        // Check if email prefix looks like an Apple ID (ugly)
        const looksLikeAppleID = (
          credential.email.includes('privaterelay.appleid.com') ||
          emailPrefix.length > 30 ||
          emailPrefix.includes('.') ||
          /^\d{6}/.test(emailPrefix) || // Starts with 6+ digits
          emailPrefix.includes('eba') ||
          emailPrefix.includes('403')
        );
        
        // Only use email prefix if it looks like a real name
        if (!looksLikeAppleID) {
          name = emailPrefix;
        }
        // Otherwise keep "Apple User" as clean fallback
      }

      const userData: User = {
        id: credential.user,
        email: credential.email || `${credential.user}@privaterelay.appleid.com`,
        name, // 🔥 Clean name - either real name or "Apple User"
        photo: null,
        dreamUsage: {
          used: 0,
          total: 0,
          resetDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
          planId: 'free',
        },
      };

      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      setUser(userData);

      router.replace('/');
    } catch (e: any) {
      if (e?.code === 'ERR_CANCELED' || e?.code === 'ERR_REQUEST_CANCELED') {
        console.log('User canceled Apple Sign-In');
        throw new Error('SIGN_IN_CANCELLED');
      } else {
        console.error('Apple Sign-In Error:', e);
        Alert.alert('Sign In Failed', 'Please try Google Sign-In instead');
        throw e;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signInWithEmail = async (email: string, _password: string) => {
    try {
      setIsLoading(true);

      const userData: User = {
        id: `local_${Date.now()}`,
        email,
        name: email.split('@')[0],
        photo: null,
        dreamUsage: {
          used: 0,
          total: 0,
          resetDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
          planId: 'free',
        },
      };

      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      setUser(userData);

      router.replace('/');
    } catch (e) {
      Alert.alert('Error', 'Sign in failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const signUpWithEmail = async (email: string, _password: string, name: string) => {
    try {
      setIsLoading(true);

      const userData: User = {
        id: `local_${Date.now()}`,
        email,
        name,
        photo: null,
        dreamUsage: {
          used: 0,
          total: 0,
          resetDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
          planId: 'free',
        },
      };

      await AsyncStorage.setItem('user', JSON.stringify(userData));
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      setUser(userData);

      router.replace('/');
    } catch (e) {
      Alert.alert('Error', 'Sign up failed');
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      try {
        await GoogleSignin.signOut();
      } catch {}
      await AsyncStorage.removeItem('user');
      await AsyncStorage.setItem('hasCompletedOnboarding', 'false');
      setUser(null);
      router.replace('/welcome');
    } catch (e) {
      console.error('Sign out error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const canGenerateDream = (): boolean =>
    !!user?.dreamUsage && user.dreamUsage.used < user.dreamUsage.total;

  const useDream = async (): Promise<boolean> => {
    if (!user?.dreamUsage || !canGenerateDream()) return false;
    const updated: User = {
      ...user,
      dreamUsage: { ...user.dreamUsage, used: user.dreamUsage.used + 1 },
    };
    setUser(updated);
    await AsyncStorage.setItem('user', JSON.stringify(updated));
    return true;
  };

  const getDreamsRemaining = (): number =>
    user?.dreamUsage ? Math.max(0, user.dreamUsage.total - user.dreamUsage.used) : 0;

  const updateSubscription = async (subscriptionInfo: SubscriptionInfo) => {
    if (!user) return;
    
    let planId: PlanId = 'free';
    if (subscriptionInfo.plan.includes('basic') || subscriptionInfo.plan === '$rc_monthly') {
      planId = 'basic';
    } else if (subscriptionInfo.plan.includes('pro') || subscriptionInfo.plan === 'Monthly') {
      planId = 'pro';
    } else if (subscriptionInfo.plan.includes('annual') || subscriptionInfo.plan === '$rc_annual') {
      planId = 'annual';
    }
    
    const updated: User = {
      ...user,
      dreamUsage: {
        used: 0,
        total: subscriptionInfo.totalDreams,
        resetDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
        planId,
      },
    };
    setUser(updated);
    await AsyncStorage.setItem('user', JSON.stringify(updated));
  };

  const updateUserName = async (newName: string) => {
    if (!user) return;
    
    const updated: User = {
      ...user,
      name: newName,
    };
    
    setUser(updated);
    await AsyncStorage.setItem('user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        tempEmail,
        signInWithGoogle,
        signInWithApple,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        sendOTP,
        verifyOTP,
        resendOTP,
        useDream,
        canGenerateDream,
        getDreamsRemaining,
        updateSubscription,
        updateUserName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default function AuthContextProvider({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}