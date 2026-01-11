// functions/src/scheduledNotifications.ts
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { getRandomMessage } from './notificationCopy';

// Expo Push Notification API
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

/**
 * Scheduled function that runs every 5 minutes to send wake-up dream reminders
 * Sends 3 notifications: 10 min before, at wake time, and 10 min after
 * Matches users by wake time + timezone
 */
export const sendDailyDreamReminders = functions
  .region('europe-west1')
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .pubsub.schedule('*/5 * * * *') // Every 5 minutes for granular timing
  .timeZone('UTC')
  .onRun(async (context) => {
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();

    console.log(`⏰ Checking for wake-time notifications at ${currentHour}:${currentMinute} UTC`);

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
        const userId = userDoc.id;
        const { deviceToken, wakeTime, timezone, lastNotificationSent } = userData;

        // Skip if no wake time or timezone configured
        if (!wakeTime || !timezone) {
          continue;
        }

        // Parse user's wake time (format: "HH:MM")
        const [wakeHour, wakeMinute] = wakeTime.split(':').map(Number);

        if (isNaN(wakeHour) || isNaN(wakeMinute)) {
          console.warn(`⚠️ Invalid wake time for user ${userDoc.id}: ${wakeTime}`);
          continue;
        }

        // Get timezone offset (use existing map or calculate)
        const offset = getTimezoneOffset(timezone);

        // Convert user's wake time to UTC
        const wakeHourUTC = (wakeHour - offset + 24) % 24;

        // Calculate notification times in UTC
        const before10UTC = {
          hour: wakeHourUTC,
          minute: (wakeMinute - 10 + 60) % 60,
          hourAdjust: wakeMinute < 10 ? -1 : 0
        };

        const atWakeUTC = {
          hour: wakeHourUTC,
          minute: wakeMinute
        };

        const after10UTC = {
          hour: wakeHourUTC,
          minute: (wakeMinute + 10) % 60,
          hourAdjust: wakeMinute >= 50 ? 1 : 0
        };

        // Adjust hours for minute wraparound
        before10UTC.hour = (before10UTC.hour + before10UTC.hourAdjust + 24) % 24;
        after10UTC.hour = (after10UTC.hour + after10UTC.hourAdjust + 24) % 24;

        // Check if current time matches any notification window (±2 minutes for reliability)
        const shouldSendBefore = Math.abs(currentHour - before10UTC.hour) === 0 &&
                                 Math.abs(currentMinute - before10UTC.minute) <= 2;

        const shouldSendAt = Math.abs(currentHour - atWakeUTC.hour) === 0 &&
                            Math.abs(currentMinute - atWakeUTC.minute) <= 2;

        const shouldSendAfter = Math.abs(currentHour - after10UTC.hour) === 0 &&
                               Math.abs(currentMinute - after10UTC.minute) <= 2;

        // Track which notifications were sent today
        const today = now.toISOString().split('T')[0]; // "2026-01-11"
        const notificationLog = lastNotificationSent || {};
        const sentToday = (notificationLog.date === today) ? notificationLog : { date: today, before: false, at: false, after: false };

        // Send BEFORE notification
        if (shouldSendBefore && !sentToday.before) {
          notifications.push({
            to: deviceToken,
            sound: 'default',
            title: "☀️ Good morning!",
            body: "You'll wake up soon. Get ready to record your dream!",
            data: {
              type: 'dream_reminder',
              timing: 'before',
              userId: userId,
              timestamp: now.getTime(),
            },
            priority: 'high',
            channelId: 'default',
          });
          sentToday.before = true;
          console.log(`✅ Sent BEFORE notification to ${userId}`);
        }

        // Send AT notification
        if (shouldSendAt && !sentToday.at) {
          notifications.push({
            to: deviceToken,
            sound: 'default',
            title: "🌙 Dream Time!",
            body: "Record your dream before it fades away",
            data: {
              type: 'dream_reminder',
              timing: 'at',
              userId: userId,
              timestamp: now.getTime(),
            },
            priority: 'high',
            channelId: 'default',
          });
          sentToday.at = true;
          console.log(`✅ Sent AT notification to ${userId}`);
        }

        // Send AFTER notification
        if (shouldSendAfter && !sentToday.after) {
          notifications.push({
            to: deviceToken,
            sound: 'default',
            title: "💭 Still remember your dream?",
            body: "Last chance to capture it before it's gone!",
            data: {
              type: 'dream_reminder',
              timing: 'after',
              userId: userId,
              timestamp: now.getTime(),
            },
            priority: 'high',
            channelId: 'default',
          });
          sentToday.after = true;
          console.log(`✅ Sent AFTER notification to ${userId}`);
        }

        // Update notification log in Firestore
        if (sentToday.before || sentToday.at || sentToday.after) {
          userUpdates.push(
            userDoc.ref.update({
              lastNotificationSent: sentToday,
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
          console.log('✅ Updated notification logs for all users');

        } catch (error) {
          console.error('❌ Failed to send notifications:', error);
          throw error;
        }
      } else {
        console.log('📭 No users to notify at this time');
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
