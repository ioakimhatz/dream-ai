// app/contexts/AuthContext.tsx - FIXED: Removed duplicate subscription tracking
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
  updateProfile
} from 'firebase/auth';
import { auth } from '../config/firebaseConfig';

// 🔥 REMOVED: dreamUsage from User interface - handled by DreamUsageContext
export interface User {
  id: string; // Firebase UID (stable across devices)
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
          
          // Create user object WITHOUT dreamUsage (handled by DreamUsageContext)
          const userData: User = {
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            photo: firebaseUser.photoURL,
          };

          await AsyncStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
          console.log('✅ User saved to AsyncStorage:', userData.id);
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

      // Verify OTP locally
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

      // 🔥 Use stored password or create new one for this email
      const passwordKey = `firebase_pwd_${tempEmail}`;
      let storedPassword = await AsyncStorage.getItem(passwordKey);
      
      if (!storedPassword) {
        storedPassword = Math.random().toString(36).slice(-16) + Math.random().toString(36).slice(-16);
        await AsyncStorage.setItem(passwordKey, storedPassword);
      }

      try {
        // Try to sign in first
        const signInCredential = await signInWithEmailAndPassword(auth, tempEmail, storedPassword);
        console.log('✅ Signed in existing user:', signInCredential.user.uid);

        await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
        setTempEmail(null);
        setTempOTP(null);

        return true;
      } catch (signInError: any) {
        // If sign in fails, create new user
        if (signInError.code === 'auth/user-not-found' || 
            signInError.code === 'auth/wrong-password' || 
            signInError.code === 'auth/invalid-credential') {
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
            console.error('Create user error:', createError);
            if (createError.code === 'auth/email-already-in-use') {
              Alert.alert('Account Exists', 'An account with this email already exists. Please use a different sign-in method.');
              return false;
            }
            throw createError;
          }
        }
        throw signInError;
      }
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

      const { idToken } = await GoogleSignin.getTokens();
      const googleCredential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, googleCredential);

      console.log('✅ Google sign-in successful:', userCredential.user.uid);

      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
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

      // Create local user (fallback - not recommended for production)
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
      
      // Sign out from Google
      try {
        await GoogleSignin.signOut();
        console.log('✅ Signed out from Google');
      } catch {}
      
      // Sign out from Firebase
      await firebaseSignOut(auth);
      console.log('✅ Signed out from Firebase');
      
      // Clear user data
      await AsyncStorage.removeItem('user');
      console.log('✅ Cleared user from AsyncStorage');
      
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
    
    // Update Firebase profile
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