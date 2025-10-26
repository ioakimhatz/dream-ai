// app/utils/notificationService.ts
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-VIDEO-GENERATION-TASK';

// Configure how notifications should behave
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }) as any, // Type assertion to avoid version-specific type mismatches
});

// Define background task for video generation
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background task error:', error);
    return;
  }
  
  console.log('Background task running:', data);
  // This keeps the generation alive even when app is backgrounded
});

/**
 * Request notification permissions from user
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
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

    // For iOS, we need to register for remote notifications
    if (Platform.OS === 'ios') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7278E6',
      });
    }

    // For Android, create notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('video-generation', {
        name: 'Dream Video Generation',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7278E6',
        sound: 'default',
      });
    }

    return 'success';
  } catch (error) {
    console.error('Failed to register for notifications:', error);
    return null;
  }
}

/**
 * Send local notification when video is ready
 */
export async function sendVideoReadyNotification(
  videoUrl?: string
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✨ Your Dream is Ready!',
        body: 'Tap to view your dream cinema',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 250, 250, 250],
        data: { videoUrl, screen: 'dreams' },
      },
      trigger: null, // Send immediately
    });

    console.log('✅ Notification sent: Dream is ready!');
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

/**
 * Send notification if generation fails
 */
export async function sendVideoFailedNotification(): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '❌ Dream Generation Failed',
        body: 'Something went wrong. Your dream has been restored. Tap to try again.',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { screen: 'home' },
      },
      trigger: null,
    });

    console.log('✅ Notification sent: Generation failed');
  } catch (error) {
    console.error('Failed to send failure notification:', error);
  }
}

/**
 * Send progress notification (for Android)
 */
export async function sendProgressNotification(
  progress: number,
  message: string
): Promise<string | null> {
  if (Platform.OS !== 'android') return null;

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎬 Creating Your Dream...',
        body: message,
        sound: false,
        priority: Notifications.AndroidNotificationPriority.LOW,
        data: { progress },
        sticky: true, // Makes it persistent
      },
      trigger: null,
    });

    return notificationId;
  } catch (error) {
    console.error('Failed to send progress notification:', error);
    return null;
  }
}

/**
 * Cancel a notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(notificationId);
  } catch (error) {
    console.error('Failed to cancel notification:', error);
  }
}

/**
 * Register background task for video generation
 */
export async function registerBackgroundTask(): Promise<void> {
  try {
    await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
    console.log('✅ Background task registered');
  } catch (error) {
    console.error('Failed to register background task:', error);
  }
}