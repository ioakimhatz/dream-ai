// functions/src/testNotification.ts
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

/**
 * Cloud Function to send a test push notification to a user
 * Usage: Call this function with { userId: "user_id" }
 *
 * Example:
 * const sendTestNotification = httpsCallable(functions, 'sendTestNotification');
 * await sendTestNotification({ userId: user.id });
 */
export const sendTestNotification = functions
  .region('europe-west1')
  .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to send test notifications'
      );
    }

    const userId = data.userId || context.auth.uid;

    try {
      console.log(`📱 Sending test notification to user: ${userId}`);

      // Get user's device token from Firestore
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(userId)
        .get();

      if (!userDoc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'User document not found'
        );
      }

      const userData = userDoc.data();
      const deviceToken = userData?.deviceToken || userData?.pushToken;

      if (!deviceToken) {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'No device token found for user. Please enable notifications first.'
        );
      }

      console.log(`✅ Found device token for user ${userId}`);

      // Determine if it's an FCM token or Expo Push Token
      const isExpoPushToken = deviceToken.startsWith('ExponentPushToken');

      if (isExpoPushToken) {
        // Send via Expo Push Notification Service
        console.log('📱 Sending via Expo Push Notification Service...');

        const expoPushMessage = {
          to: deviceToken,
          sound: 'default',
          title: '🔥 Test Notification',
          body: 'Wake up and record your dream! This is a test notification from the cloud.',
          data: {
            type: 'test',
            timestamp: Date.now(),
            source: 'cloud_function'
          },
          priority: 'high',
          channelId: 'default',
        };

        // Send to Expo Push Notification service
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(expoPushMessage),
        });

        const result = await response.json();
        console.log('📬 Expo push response:', result);

        if (result.data?.[0]?.status === 'error') {
          throw new functions.https.HttpsError(
            'internal',
            `Expo push error: ${result.data[0].message}`
          );
        }

      } else {
        // Send via Firebase Cloud Messaging (FCM)
        console.log('📱 Sending via Firebase Cloud Messaging...');

        const message: admin.messaging.Message = {
          notification: {
            title: '🔥 Test Notification',
            body: 'Wake up and record your dream! This is a test notification from the cloud.',
          },
          data: {
            type: 'test',
            timestamp: Date.now().toString(),
            source: 'cloud_function',
          },
          token: deviceToken,
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
          android: {
            priority: 'high',
            notification: {
              channelId: 'default',
              sound: 'default',
              priority: 'high',
            },
          },
        };

        const messageId = await admin.messaging().send(message);
        console.log('✅ FCM notification sent successfully:', messageId);
      }

      return {
        success: true,
        message: 'Test notification sent successfully',
        timestamp: Date.now(),
      };

    } catch (error: any) {
      console.error('❌ Error sending test notification:', error);

      // Re-throw HttpsErrors
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      // Handle FCM errors
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        throw new functions.https.HttpsError(
          'failed-precondition',
          'Device token is invalid or expired. Please re-enable notifications in settings.'
        );
      }

      // Generic error
      throw new functions.https.HttpsError(
        'internal',
        `Failed to send notification: ${error.message}`
      );
    }
  });
