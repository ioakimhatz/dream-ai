// app/utils/notificationService.ts - Expo Push Notifications ONLY
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { doc, setDoc, Timestamp, getDoc } from 'firebase/firestore';
import { firestore } from '../config/firebaseConfig';

// ✅ FIX: Use expo-device for reliable detection (Constants.isDevice can be undefined)
const isSimulator = !Device.isDevice;

// Dynamically import expo-notifications (not available on simulator)
let Notifications: any = null;

if (!isSimulator) {
  try {
    Notifications = require('expo-notifications');
    // Configure how notifications should behave
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch (e) {
    console.log('📱 Expo Notifications not available on simulator');
  }
} else {
  console.log('📱 Running on simulator - notifications disabled');
}

/**
 * Request push notification permissions and get Expo Push Token
 * This is the main function to call for registering push notifications
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // DEBUG: Log device info
  console.log('🔍 DEVICE DEBUG:');
  console.log('  - Device.isDevice:', Device.isDevice);
  console.log('  - Device.deviceType:', Device.deviceType);
  console.log('  - Device.modelName:', Device.modelName);
  console.log('  - Platform.OS:', Platform.OS);
  console.log('  - Constants.isDevice:', Constants.isDevice);
  console.log('  - isSimulator:', isSimulator);

  if (!Device.isDevice) {
    console.log('📱 Cannot register push notifications on simulator');
    return null;
  }

  if (!Notifications) {
    console.log('⚠️ Notifications module not available');
    return null;
  }

  console.log('📱 Registering for push notifications on REAL device...');

  try {
    // Request permission via Expo (works on both iOS and Android)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('❌ Notification permission denied');
      return null;
    }

    console.log('✅ Notification permission granted');

    // Create notification channels for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('video-generation', {
        name: 'Dream Video Generation',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7278E6',
        sound: 'default',
        description: 'Notifications for when your dream videos are ready',
      });

      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7278E6',
        sound: 'default',
      });
    }

    // Get Expo Push Token
    const expoToken = (await Notifications.getExpoPushTokenAsync({
      projectId: '0fa46614-499e-4052-90a9-43f3c98b573b', // Your EAS project ID from app.json
    })).data;
    console.log('📱 Expo Push Token:', expoToken);
    return expoToken;

  } catch (error) {
    console.error('Failed to register for notifications:', error);
    return null;
  }
}

/**
 * Save Expo Push Token to Firestore
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  if (isSimulator || !token) {
    console.log('📱 Skipping token save on simulator');
    return;
  }

  try {
    const userRef = doc(firestore, 'users', userId);
    await setDoc(
      userRef,
      {
        deviceToken: token, // Expo Push Token
        pushTokenUpdatedAt: Timestamp.now(),
        notificationsEnabled: true,
        platform: Platform.OS,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      { merge: true }
    );
    console.log('✅ Push token saved to Firestore for user:', userId);
  } catch (error) {
    console.error('❌ Failed to save push token:', error);
    throw error;
  }
}

// Keep old name for backward compatibility
export const saveFCMToken = savePushToken;

/**
 * Send a test notification to a specific device token
 * This is a client-side helper that calls the cloud function
 */
export async function sendTestNotification(userId: string): Promise<boolean> {
  if (isSimulator) {
    console.log('📱 Cannot send test notification on simulator');
    return false;
  }

  try {
    // First verify the user has a device token
    const userRef = doc(firestore, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      console.error('❌ User document not found');
      return false;
    }

    const userData = userDoc.data();
    const deviceToken = userData?.deviceToken || userData?.pushToken;

    if (!deviceToken) {
      console.error('❌ No device token found for user');
      return false;
    }

    console.log('📱 Device token found, sending local test notification...');

    // Send a local notification as a test
    if (Notifications) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔥 Test Notification',
          body: 'Wake up and record your dream! This is a test notification.',
          data: { type: 'test', timestamp: Date.now() },
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // Send immediately
      });
      console.log('✅ Test notification sent successfully');
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Failed to send test notification:', error);
    return false;
  }
}

/**
 * Check if we've already sent a local notification for this job
 */
async function hasNotifiedForJob(jobId: string): Promise<boolean> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const notifiedJobs = await AsyncStorage.getItem('@notified_jobs');
    if (!notifiedJobs) return false;

    const jobsArray: string[] = JSON.parse(notifiedJobs);
    return jobsArray.includes(jobId);
  } catch (error) {
    console.error('❌ Failed to check notification status:', error);
    return false; // On error, allow notification
  }
}

/**
 * Mark a job as notified
 */
async function markJobAsNotified(jobId: string): Promise<void> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const notifiedJobs = await AsyncStorage.getItem('@notified_jobs');
    const jobsArray: string[] = notifiedJobs ? JSON.parse(notifiedJobs) : [];

    if (!jobsArray.includes(jobId)) {
      jobsArray.push(jobId);
      // Keep only last 100 job IDs to prevent unbounded growth
      const trimmedArray = jobsArray.slice(-100);
      await AsyncStorage.setItem('@notified_jobs', JSON.stringify(trimmedArray));
      console.log(`📋 Marked job ${jobId} as notified`);
    }
  } catch (error) {
    console.error('❌ Failed to mark job as notified:', error);
  }
}

/**
 * Send a local notification when video is ready
 * (Fallback for when push notifications fail)
 * Only sends once per jobId to prevent duplicates
 */
export async function sendVideoReadyNotification(videoUrl: string, jobId?: string): Promise<void> {
  if (isSimulator || !Notifications) {
    console.log('📱 Skipping notification on simulator');
    return;
  }

  try {
    // If jobId provided, check if we already notified
    if (jobId) {
      const alreadyNotified = await hasNotifiedForJob(jobId);
      if (alreadyNotified) {
        console.log(`⏭️ Skipping notification for job ${jobId} - already sent`);
        return;
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎬 Your Dream is Ready!',
        body: 'Your dream video has been generated successfully. Tap to view!',
        data: { videoUrl, type: 'video_ready', jobId: jobId || '' },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null, // Send immediately
    });

    console.log(`✅ Local notification sent: Video ready${jobId ? ` (job: ${jobId})` : ''}`);

    // Mark as notified
    if (jobId) {
      await markJobAsNotified(jobId);
    }
  } catch (error) {
    console.error('❌ Failed to send local notification:', error);
  }
}

/**
 * Send a local notification when video generation fails
 * Only sends once per jobId to prevent duplicates
 */
export async function sendVideoFailedNotification(jobId?: string): Promise<void> {
  if (isSimulator || !Notifications) {
    console.log('📱 Skipping notification on simulator');
    return;
  }

  try {
    // If jobId provided, check if we already notified
    if (jobId) {
      const alreadyNotified = await hasNotifiedForJob(jobId);
      if (alreadyNotified) {
        console.log(`⏭️ Skipping notification for job ${jobId} - already sent`);
        return;
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '❌ Dream Generation Failed',
        body: 'We couldn\'t generate your dream. Your credit has been restored. Please try again.',
        data: { type: 'video_failed', jobId: jobId || '' },
        sound: 'default',
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: null,
    });

    console.log(`✅ Local notification sent: Video failed${jobId ? ` (job: ${jobId})` : ''}`);

    // Mark as notified
    if (jobId) {
      await markJobAsNotified(jobId);
    }
  } catch (error) {
    console.error('❌ Failed to send local notification:', error);
  }
}

/**
 * Setup notification listeners
 */
export function setupNotificationListeners(router?: any) {
  if (isSimulator || !Notifications) {
    console.log('📱 Skipping notification listeners on simulator');
    return () => { }; // Return empty cleanup function
  }

  // Handle notification received while app is in foreground
  const foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
    console.log('📬 Notification received in foreground:', notification);
  });

  // Handle notification tapped
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;

    console.log('📱 User tapped notification:', data);

    // Route based on notification type
    if (router) {
      if (data?.videoUrl || data?.jobId) {
        // Video ready notification - go to library
        router.push('/(tabs)/library');
      } else if (data?.type === 'wake_reminder' || data?.type === 'dream_reminder') {
        // Wake-up reminder - go to home (dream entry)
        router.push('/(tabs)/');
      } else {
        // Default - go to home
        router.push('/(tabs)/');
      }
    }
  });

  return () => {
    foregroundSubscription.remove();
    responseSubscription.remove();
  };
}

/**
 * Cancel all pending notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  if (isSimulator || !Notifications) {
    console.log('📱 Skipping notification cancel on simulator');
    return;
  }

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('✅ All scheduled notifications cancelled');
  } catch (error) {
    console.error('❌ Failed to cancel notifications:', error);
  }
}