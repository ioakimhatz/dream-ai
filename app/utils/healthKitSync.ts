// app/utils/healthKitSync.ts
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { firestore } from '../config/firebaseConfig';
import { getSleepSchedule, isHealthKitAvailable } from '../services/healthKitService';

/**
 * Sync HealthKit sleep data to Firestore
 * Called on app open to keep wake time updated
 */
export async function syncHealthKitData(userId: string): Promise<void> {
  if (!isHealthKitAvailable()) {
    console.log('⚠️ HealthKit not available, skipping sync');
    return;
  }

  try {
    // Check if user has HealthKit enabled
    const userRef = doc(firestore, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      console.log('⚠️ User document not found');
      return;
    }

    const userData = userDoc.data();

    // Only sync if user has HealthKit as their wake time source
    if (userData.wakeTimeSource !== 'healthkit') {
      console.log('⏭️ Skipping HealthKit sync - user is using manual wake time');
      return;
    }

    console.log('🔄 Syncing HealthKit sleep data...');

    // Get latest sleep schedule from HealthKit
    const schedule = await getSleepSchedule();

    if (!schedule) {
      console.log('📭 No sleep data found in HealthKit');
      return;
    }

    // Check if wake time has changed
    const currentWakeTime = userData.wakeTime;
    const newWakeTime = schedule.weekday.wakeup;

    if (currentWakeTime !== newWakeTime) {
      console.log(`🔄 Wake time changed: ${currentWakeTime} → ${newWakeTime}`);

      // Update Firestore with new sleep schedule
      await setDoc(
        userRef,
        {
          wakeTime: newWakeTime,
          sleepSchedule: schedule,
          wakeTimeSource: 'healthkit',
          lastHealthKitSync: new Date().toISOString(),
        },
        { merge: true }
      );

      console.log('✅ HealthKit sleep data synced to Firestore');
    } else {
      console.log('✓ Wake time unchanged, updating sync timestamp only');

      await setDoc(
        userRef,
        {
          sleepSchedule: schedule,
          lastHealthKitSync: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    console.error('❌ Failed to sync HealthKit data:', error);
    // Don't throw - we don't want to break the app if sync fails
  }
}

/**
 * Disconnect HealthKit and switch to manual wake time
 */
export async function disconnectHealthKit(userId: string): Promise<void> {
  try {
    const userRef = doc(firestore, 'users', userId);

    await setDoc(
      userRef,
      {
        wakeTimeSource: 'manual',
        lastHealthKitSync: null,
      },
      { merge: true }
    );

    console.log('✅ HealthKit disconnected');
  } catch (error) {
    console.error('❌ Failed to disconnect HealthKit:', error);
    throw error;
  }
}
