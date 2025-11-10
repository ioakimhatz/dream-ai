// functions/src/utils/sendNotification.ts - FCM Push Notifications
import * as admin from 'firebase-admin';

/**
 * Send FCM push notification to a specific user
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  try {
    // Fetch user's FCM token from Firestore
    const userRef = admin.firestore().collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`⚠️ User ${userId} not found in Firestore`);
      return false;
    }

    const userData = userDoc.data();
    const pushToken = userData?.pushToken;

    if (!pushToken) {
      console.log(`⚠️ No push token found for user ${userId}`);
      return false;
    }

    console.log(`📱 Sending notification to user ${userId}...`);

    // Send FCM notification
    const message: admin.messaging.Message = {
      token: pushToken,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          channelId: 'video-generation',
          priority: 'high',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log(`✅ Notification sent successfully:`, response);
    return true;

  } catch (error: any) {
    console.error(`❌ Failed to send notification to user ${userId}:`, error);

    // If token is invalid, remove it from Firestore
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      console.log(`🗑️ Removing invalid token for user ${userId}`);
      try {
        const userRef = admin.firestore().collection('users').doc(userId);
        await userRef.update({
          pushToken: admin.firestore.FieldValue.delete(),
        });
      } catch (updateError) {
        console.error('Failed to remove invalid token:', updateError);
      }
    }

    return false;
  }
}

/**
 * Send notification when video generation completes successfully
 */
export async function sendVideoReadyNotification(
  userId: string,
  videoUrl: string,
  jobId: string
): Promise<void> {
  await sendPushNotification(
    userId,
    '🎬 Your Dream is Ready!',
    'Your dream video has been generated successfully. Tap to view!',
    {
      type: 'video_ready',
      videoUrl,
      jobId,
    }
  );
}

/**
 * Send notification when video generation fails
 */
export async function sendVideoFailedNotification(
  userId: string,
  jobId: string,
  errorMessage?: string
): Promise<void> {
  await sendPushNotification(
    userId,
    '❌ Dream Generation Failed',
    errorMessage || "We couldn't generate your dream. Your credit has been restored. Please try again.",
    {
      type: 'video_failed',
      jobId,
    }
  );
}
