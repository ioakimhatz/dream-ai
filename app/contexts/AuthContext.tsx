// app/contexts/AuthContext.tsx - COMPLETE FIXED VERSION
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { EmailService } from '../../lib/emailjs-service';

// 🔥 Firebase imports
import {
  signInWithCredential,
  GoogleAuthProvider,
  OAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  fetchSignInMethodsForEmail,
  EmailAuthProvider,
  linkWithCredential
} from 'firebase/auth';
import { auth } from '../config/firebaseConfig';

// 🔔 Notification service
import { registerForPushNotifications, saveFCMToken } from '../utils/notificationService';

// 🔄 Pending data sync
import { syncPendingWakeTime } from '../utils/syncPendingData';

export interface User {
  id: string;
  email: string;
  name: string;
  photo?: string | null;
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

  updateUserName: (newName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tempEmail, setTempEmail] = useState<string | null>(null);
  const [tempOTP, setTempOTP] = useState<string | null>(null);

  // 🔥 Listen to Firebase Auth state changes
  useEffect(() => {
    console.log('🔥 Setting up Firebase auth listener...');
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          console.log('✅ Firebase user detected:', firebaseUser.uid);

          const userData: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            photo: firebaseUser.photoURL,
          };

          await AsyncStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
          console.log('✅ User saved to AsyncStorage:', userData.id);

          // 🔄 Sync any pending wake time from onboarding
          await syncPendingWakeTime(firebaseUser.uid);
        } else {
          console.log('❌ No Firebase user, clearing state');
          setUser(null);
        }
      } catch (e) {
        console.error('❌ Auth state change error:', e);
      } finally {
        setIsLoading(false);
      }
    });

    return () => {
      console.log('🔥 Cleaning up Firebase auth listener');
      unsubscribe();
    };
  }, []);

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

      // ✅ STEP 1: Verify OTP locally
      const [storedOTP, storedEmail, storedExpires] = await AsyncStorage.multiGet([
        'temp_otp',
        'temp_otp_email',
        'temp_otp_expires',
      ]).then((pairs) => pairs.map(([, v]) => v));

      if (storedExpires && Date.now() > parseInt(storedExpires, 10)) {
        await AsyncStorage.multiRemove(['temp_otp', 'temp_otp_email', 'temp_otp_expires']);
        Alert.alert('Expired Code', 'Your verification code has expired. Please request a new one.');
        return false;
      }

      if (storedEmail !== tempEmail || storedOTP !== code) {
        Alert.alert('Invalid Code', 'The code you entered is incorrect. Please try again.');
        return false;
      }

      console.log('✅ OTP verified successfully');
      await AsyncStorage.multiRemove(['temp_otp', 'temp_otp_email', 'temp_otp_expires']);

      // ✅ STEP 2: Get or generate password for this email
      const passwordKey = `firebase_pwd_${tempEmail}`;
      let storedPassword = await AsyncStorage.getItem(passwordKey);

      if (!storedPassword) {
        storedPassword = Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16);
        await AsyncStorage.setItem(passwordKey, storedPassword);
        console.log('✅ Generated new password for email');
      } else {
        console.log('✅ Using existing password for email');
      }

      // ✅ STEP 3: Check if account exists with this email
      const signInMethods = await fetchSignInMethodsForEmail(auth, tempEmail);
      console.log('📧 Sign-in methods for this email:', signInMethods);

      // ✅ STEP 4: Handle different scenarios
      if (signInMethods.length === 0) {
        // 🆕 No account exists - create new one
        console.log('🆕 Creating new account with email/password');
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, tempEmail, storedPassword);
          console.log('✅ Created new user:', userCredential.user.uid);

          await updateProfile(userCredential.user, {
            displayName: tempEmail.split('@')[0]
          });

          await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
          setTempEmail(null);
          setTempOTP(null);

          return true;
        } catch (createError: any) {
          console.error('❌ Create user error:', createError);

          // 🔥 EDGE CASE: If account exists but wasn't detected by fetchSignInMethodsForEmail
          if (createError.code === 'auth/email-already-in-use') {
            console.log('⚠️ Account exists but was not detected. Trying to sign in...');

            try {
              // Try signing in with the stored password
              const signInCredential = await signInWithEmailAndPassword(auth, tempEmail, storedPassword);
              console.log('✅ Successfully signed in to existing account:', signInCredential.user.uid);

              await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
              setTempEmail(null);
              setTempOTP(null);

              return true;
            } catch (signInError: any) {
              console.error('❌ Sign in also failed:', signInError);

              // Account exists but with different credentials (Google/Apple)
              Alert.alert(
                'Account Already Exists',
                'This email is already registered. Please sign in using the same method you used before (Google, Apple, or email).',
                [
                  {
                    text: 'Go Back',
                    onPress: () => router.back()
                  }
                ]
              );
              return false;
            }
          }

          Alert.alert('Error', 'Failed to create account. Please try again.');
          return false;
        }
      } else if (signInMethods.includes('password')) {
        // 🔑 Account exists with email/password - sign in
        console.log('🔑 Account exists with password, signing in');
        try {
          const signInCredential = await signInWithEmailAndPassword(auth, tempEmail, storedPassword);
          console.log('✅ Signed in existing user:', signInCredential.user.uid);

          await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
          setTempEmail(null);
          setTempOTP(null);

          return true;
        } catch (signInError: any) {
          console.error('❌ Sign in error:', signInError);
          if (signInError.code === 'auth/wrong-password' || signInError.code === 'auth/invalid-credential') {
            Alert.alert(
              'Account Found',
              'An account exists with this email but with a different sign-in method. Please use the same method you used before.'
            );
            return false;
          }
          Alert.alert('Error', 'Failed to sign in. Please try again.');
          return false;
        }
      } else {
        // 🔗 Account exists with other methods (Google/Apple)
        console.log('🔗 Account exists with other methods:', signInMethods);

        // Format the sign-in methods nicely
        const methodNames = signInMethods
          .map(method => {
            if (method === 'google.com') return 'Google';
            if (method === 'apple.com') return 'Apple';
            return method;
          })
          .join(' or ');

        Alert.alert(
          'Account Already Exists',
          `This email is already linked to a ${methodNames} account. Please use the "${methodNames}" button to sign in.`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back to sign-in screen
                router.back();
              }
            }
          ]
        );
        return false;
      }
    } catch (e: any) {
      console.error('❌ verifyOTP error:', e);

      // Handle specific Firebase errors
      if (e.code === 'auth/email-already-in-use') {
        Alert.alert(
          'Account Already Exists',
          'An account with this email already exists. Please use your original sign-in method (Google or Apple).',
          [
            {
              text: 'OK',
              onPress: () => router.back()
            }
          ]
        );
      } else if (e.code === 'auth/network-request-failed') {
        Alert.alert('Network Error', 'Please check your internet connection and try again.');
      } else {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }

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

      const { idToken } = await GoogleSignin.getTokens();
      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, googleCredential);

      console.log('✅ Google sign-in successful:', userCredential.user.uid);

      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');

      // 🔔 Notification registration removed - now handled in onboarding
      // Wake-up time is set during onboarding flow, not on sign-in

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

      const appleCredential = new OAuthProvider('apple.com').credential({
        idToken: credential.identityToken!,
        rawNonce: undefined,
      });
      const userCredential = await signInWithCredential(auth, appleCredential);

      console.log('✅ Apple sign-in successful:', userCredential.user.uid);

      // Smart name extraction
      let name = 'Apple User';

      if (credential.fullName) {
        const { givenName, familyName } = credential.fullName;
        const built = [givenName, familyName].filter(Boolean).join(' ').trim();
        if (built) name = built;
      }

      if (name === 'Apple User' && credential.email) {
        const emailPrefix = credential.email.split('@')[0];
        const looksLikeAppleID = (
          credential.email.includes('privaterelay.appleid.com') ||
          emailPrefix.length > 30 ||
          emailPrefix.includes('.') ||
          /^\d{6}/.test(emailPrefix) ||
          emailPrefix.includes('eba') ||
          emailPrefix.includes('403')
        );

        if (!looksLikeAppleID) name = emailPrefix;
      }

      if (name !== 'Apple User' && !userCredential.user.displayName) {
        await updateProfile(userCredential.user, { displayName: name });
      }

      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');

      // 🔔 Notification registration removed - now handled in onboarding
      // Wake-up time is set during onboarding flow, not on sign-in

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
      console.log('🔥 Signing out user:', user?.id);

      try {
        await GoogleSignin.signOut();
        console.log('✅ Signed out from Google');
      } catch { }

      await firebaseSignOut(auth);
      console.log('✅ Signed out from Firebase');

      await AsyncStorage.removeItem('user');
      console.log('✅ Cleared user from AsyncStorage');

      await AsyncStorage.removeItem('permissions_requested');
      console.log('✅ Cleared permissions flag from AsyncStorage');

      // 🔄 Clear any pending wake time data
      await AsyncStorage.removeItem('@dream_ai:pending_wake_time');
      console.log('✅ Cleared pending wake time from AsyncStorage');

      await AsyncStorage.setItem('hasCompletedOnboarding', 'false');
      setUser(null);

      router.replace('/welcome');
    } catch (e) {
      console.error('Sign out error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUserName = async (newName: string) => {
    if (!user) return;

    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: newName });
    }

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