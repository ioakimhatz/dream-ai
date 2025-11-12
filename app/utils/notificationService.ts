// app/utils/notificationService.ts - Expo-compatible version (no native Firebase)
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { firestore } from '../config/firebaseConfig';

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

/**
 * Request push notification permissions and get Expo Push Token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Request permission
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
    
    // Get Expo Push Token
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: '0fa46614-499e-4052-90a9-43f3c98b573b', // Your EAS project ID from app.json
    })).data;
    
    console.log('📱 Expo Push Token:', token);
    
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
    
    return token;
  } catch (error) {
    console.error('Failed to register for notifications:', error);
    return null;
  }
}

/**
 * Save Expo Push Token to Firestore
 */
export async function saveFCMToken(userId: string, token: string): Promise<void> {
  try {
    const userRef = doc(firestore, 'users', userId);
    await setDoc(
      userRef,
      {
        pushToken: token,
        pushTokenUpdatedAt: Timestamp.now(),
        platform: Platform.OS,
      },
      { merge: true }
    );
    console.log('✅ Push token saved to Firestore for user:', userId);
  } catch (error) {
    console.error('❌ Failed to save push token:', error);
    throw error;
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
export function setupNotificationListeners() {
  // Handle notification received while app is in foreground
  const foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
    console.log('📬 Notification received in foreground:', notification);
  });
  
  // Handle notification tapped
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('👆 Notification tapped:', response);
    const { videoUrl, type } = response.notification.request.content.data;
    
    if (type === 'video_ready' && videoUrl) {
      // Navigate to video or open it
      console.log('📹 Opening video:', videoUrl);
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
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    console.log('✅ All scheduled notifications cancelled');
  } catch (error) {
    console.error('❌ Failed to cancel notifications:', error);
  }
}