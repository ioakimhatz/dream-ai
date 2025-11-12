// functions/src/utils/sendNotification.ts - Expo Push Notifications
import * as admin from 'firebase-admin';

/**
 * Expo Push Notification API response types
 */
interface ExpoPushSuccessTicket {
  status: 'ok';
  id: string;
}

interface ExpoPushErrorTicket {
  status: 'error';
  message: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded';
  };
}

type ExpoPushTicket = ExpoPushSuccessTicket | ExpoPushErrorTicket;

interface ExpoPushResponse {
  data: ExpoPushTicket[];
}

/**
 * Send push notification to a specific user using Expo Push Service
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  try {
    // Fetch user's Expo Push Token from Firestore
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

    // Validate it's an Expo Push Token
    if (!pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken[')) {
      console.log(`⚠️ Invalid Expo Push Token format for user ${userId}: ${pushToken.substring(0, 20)}...`);
      return false;
    }

    console.log(`📱 Sending Expo notification to user ${userId}...`);
    console.log(`📱 Token: ${pushToken.substring(0, 30)}...`);

    // Prepare Expo Push Notification payload
    const message = {
      to: pushToken,
      title,
      body,
      data: data || {},
      sound: 'default',
      priority: 'high',
      channelId: 'video-generation', // Android notification channel
      badge: 1,
    };

    // Send to Expo Push Notification Service
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Expo API responded with status ${response.status}: ${response.statusText}`);
    }

    const result: ExpoPushResponse = await response.json();
    console.log(`📬 Expo API response:`, JSON.stringify(result, null, 2));

    // Check the ticket status
    if (result.data && result.data.length > 0) {
      const ticket = result.data[0];

      if (ticket.status === 'ok') {
        console.log(`✅ Notification sent successfully! Ticket ID: ${ticket.id}`);
        return true;
      } else if (ticket.status === 'error') {
        console.error(`❌ Expo push error: ${ticket.message}`);

        // Handle device not registered error
        if (ticket.details?.error === 'DeviceNotRegistered') {
          console.log(`🗑️ Device not registered, removing invalid token for user ${userId}`);
          try {
            await userRef.update({
              pushToken: admin.firestore.FieldValue.delete(),
            });
          } catch (updateError) {
            console.error('Failed to remove invalid token:', updateError);
          }
        }

        // Handle rate limiting
        if (ticket.details?.error === 'MessageRateExceeded') {
          console.warn(`⚠️ Rate limit exceeded for user ${userId}. Will retry later.`);
        }

        return false;
      }
    }

    console.warn(`⚠️ Unexpected Expo API response format`);
    return false;

  } catch (error: any) {
    console.error(`❌ Failed to send notification to user ${userId}:`, error);

    // Log network errors
    if (error.name === 'FetchError' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      console.error(`🌐 Network error while sending notification: ${error.message}`);
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
