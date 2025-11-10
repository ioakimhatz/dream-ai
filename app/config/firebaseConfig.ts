// app/config/firebaseConfig.ts - FIXED: Compatible with all Firebase 12.x versions
import { FirebaseApp, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Auth } from 'firebase/auth';

// Your Firebase configuration from GoogleService-Info.plist
const firebaseConfig = {
  apiKey: "AIzaSyCbTRZYuud_Q7KO6oins9nVbSoo6sW14Eg",
  authDomain: "dream-ai-80b36.firebaseapp.com",
  projectId: "dream-ai-80b36",
  storageBucket: "dream-ai-80b36.firebasestorage.app",
  messagingSenderId: "711898710429",
  appId: "1:711898710429:ios:a88714ccfa19582c8baf74"
};

// Initialize Firebase
const app: FirebaseApp = initializeApp(firebaseConfig);

// 🔥 Initialize Auth with React Native persistence (safe import)
let auth: Auth;

try {
  // Try to import and use React Native persistence
  const { initializeAuth, getReactNativePersistence } = require('firebase/auth');
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
  console.log('✅ Firebase Auth initialized with AsyncStorage persistence');
} catch (error) {
  // Fallback to regular auth if persistence not available
  console.warn('⚠️ Using fallback auth initialization');
  const { getAuth } = require('firebase/auth');
  auth = getAuth(app);
}

// Initialize Firestore
export const firestore = getFirestore(app);

export { auth };
export default app;