import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig';

/**
 * Syncs pending wake time from AsyncStorage to Firestore after authentication
 */
export async function syncPendingWakeTime(userId: string): Promise<boolean> {
  try {
    console.log('🔄 Checking for pending wake time to sync...');

    const pendingData = await AsyncStorage.getItem('@dream_ai:pending_wake_time');

    if (!pendingData) {
      console.log('ℹ️ No pending wake time found');
      return false;
    }

    const { wakeTime, wakeTimeSource, timezone } = JSON.parse(pendingData);

    console.log('📤 Syncing pending wake time to Firestore:', wakeTime);

    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      wakeTime,
      wakeTimeSource,
      timezone,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Clear AsyncStorage after successful sync
    await AsyncStorage.removeItem('@dream_ai:pending_wake_time');

    console.log('✅ Pending wake time synced successfully');
    return true;
  } catch (error) {
    console.error('❌ Failed to sync pending wake time:', error);
    return false;
  }
}
