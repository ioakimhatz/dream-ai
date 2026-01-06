// functions/src/scheduledNotifications.ts
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getRandomMessage } from './notificationCopy';

// Expo Push Notification API
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Scheduled function that runs every hour to send wake-up dream reminders
 * Matches users by wake time + timezone
 */
export const sendDailyDreamReminders = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .pubsub.schedule('0 * * * *') // Every hour on the hour
  .timeZone('UTC')
  .onRun(async (context) => {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();

    console.log(`🕐 Running scheduled notification check at UTC ${currentHour}:${currentMinute}`);

    try {
      // Query users with notifications enabled and device tokens
      const usersSnapshot = await admin.firestore()
        .collection('users')
        .where('notificationsEnabled', '==', true)
        .where('deviceToken', '!=', null)
        .get();

      console.log(`📋 Found ${usersSnapshot.size} users with notifications enabled`);

      const notifications: any[] = [];
      const userUpdates: Promise<any>[] = [];

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data();
        const { deviceToken, wakeTime, timezone, lastNotificationSent } = userData;

        // Skip if no wake time or timezone configured
        if (!wakeTime || !timezone) {
          continue;
        }

        // Check if already notified in last 20 hours (prevent duplicates)
        if (lastNotificationSent) {
          const lastSentTime = lastNotificationSent.toDate();
          const hoursSinceLastNotification = (now.getTime() - lastSentTime.getTime()) / (1000 * 60 * 60);

          if (hoursSinceLastNotification < 20) {
            console.log(`⏭️ Skipping user ${userDoc.id} - already notified ${hoursSinceLastNotification.toFixed(1)}h ago`);
            continue;
          }
        }

        // Parse user's wake time (format: "HH:MM")
        const [wakeHour, wakeMinute] = wakeTime.split(':').map(Number);

        if (isNaN(wakeHour) || isNaN(wakeMinute)) {
          console.warn(`⚠️ Invalid wake time for user ${userDoc.id}: ${wakeTime}`);
          continue;
        }

        // Calculate timezone offset and convert to UTC
        const timezoneOffset = getTimezoneOffset(timezone);
        const utcWakeHour = (wakeHour - timezoneOffset + 24) % 24;

        // Check if current hour matches wake hour (±1 hour tolerance)
        const hourDifference = Math.abs(currentHour - utcWakeHour);

        if (hourDifference <= 1 || hourDifference >= 23) {
          console.log(`✅ Scheduling notification for user ${userDoc.id} (wake: ${wakeTime} ${timezone}, UTC: ${utcWakeHour}:00)`);

          const message = getRandomMessage();

          // Add to batch
          notifications.push({
            to: deviceToken,
            sound: 'default',
            title: message.title,
            body: message.body,
            data: {
              type: 'wake_reminder',
              userId: userDoc.id,
              timestamp: now.getTime(),
            },
            priority: 'high',
            channelId: 'default',
          });

          // Update last notification sent
          userUpdates.push(
            userDoc.ref.update({
              lastNotificationSent: admin.firestore.FieldValue.serverTimestamp(),
            })
          );
        }
      }

      // Send batch notifications to Expo Push Service
      if (notifications.length > 0) {
        console.log(`📱 Sending ${notifications.length} notifications to Expo Push Service...`);

        try {
          const response = await fetch(EXPO_PUSH_URL, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(notifications),
          });

          const result = await response.json();
          console.log('✅ Expo Push API response:', JSON.stringify(result, null, 2));

          // Check for errors in response
          if (result.data) {
            for (const item of result.data) {
              if (item.status === 'error') {
                console.error('❌ Notification error:', item.message, item.details);
              }
            }
          }

          // Update Firestore with last notification sent
          await Promise.all(userUpdates);
          console.log('✅ Updated lastNotificationSent for all users');

        } catch (error) {
          console.error('❌ Failed to send notifications:', error);
          throw error;
        }
      } else {
        console.log('📭 No users to notify at this hour');
      }

      return null;

    } catch (error) {
      console.error('❌ Error in sendDailyDreamReminders:', error);
      throw error;
    }
  });

/**
 * Simple timezone offset helper
 * Maps common timezone names to UTC offset in hours
 * Can be improved with moment-timezone if needed for better accuracy
 */
function getTimezoneOffset(timezone: string): number {
  // Common timezone offsets (standard time, not DST)
  const offsets: Record<string, number> = {
    // US & Canada
    'America/New_York': -5,
    'America/Chicago': -6,
    'America/Denver': -7,
    'America/Los_Angeles': -8,
    'America/Phoenix': -7,
    'America/Anchorage': -9,
    'America/Honolulu': -10,
    'America/Toronto': -5,
    'America/Vancouver': -8,

    // Europe
    'Europe/London': 0,
    'Europe/Paris': 1,
    'Europe/Berlin': 1,
    'Europe/Rome': 1,
    'Europe/Madrid': 1,
    'Europe/Amsterdam': 1,
    'Europe/Brussels': 1,
    'Europe/Vienna': 1,
    'Europe/Stockholm': 1,
    'Europe/Moscow': 3,

    // Asia
    'Asia/Tokyo': 9,
    'Asia/Shanghai': 8,
    'Asia/Hong_Kong': 8,
    'Asia/Singapore': 8,
    'Asia/Dubai': 4,
    'Asia/Kolkata': 5.5,
    'Asia/Bangkok': 7,

    // Australia
    'Australia/Sydney': 10,
    'Australia/Melbourne': 10,
    'Australia/Brisbane': 10,
    'Australia/Perth': 8,

    // Other
    'Pacific/Auckland': 12,
    'America/Sao_Paulo': -3,
    'America/Mexico_City': -6,
    'America/Buenos_Aires': -3,
  };

  const offset = offsets[timezone];

  if (offset === undefined) {
    console.warn(`⚠️ Unknown timezone: ${timezone}, using UTC offset 0`);
    return 0;
  }

  return offset;
}
