// functions/src/scheduledNotifications.ts
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as moment from 'moment-timezone';
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

        // Convert user's local wake time to UTC using moment-timezone
        const utcTime = convertLocalTimeToUTC(wakeTime, timezone);

        // Calculate the 3 notification windows: -10min, 0min, +10min using moment
        const beforeWindowStart = moment.utc()
          .hours(utcTime.hours)
          .minutes(utcTime.minutes)
          .subtract(10, 'minutes');

        const atWindow = moment.utc()
          .hours(utcTime.hours)
          .minutes(utcTime.minutes);

        const afterWindowStart = moment.utc()
          .hours(utcTime.hours)
          .minutes(utcTime.minutes)
          .add(10, 'minutes');

        const nowMoment = moment.utc();

        // Check if current time matches any window (±2 minutes tolerance)
        const shouldSendBefore = Math.abs(nowMoment.diff(beforeWindowStart, 'minutes')) <= 2;
        const shouldSendAt = Math.abs(nowMoment.diff(atWindow, 'minutes')) <= 2;
        const shouldSendAfter = Math.abs(nowMoment.diff(afterWindowStart, 'minutes')) <= 2;

        // Skip if no window matches
        if (!shouldSendBefore && !shouldSendAt && !shouldSendAfter) {
          continue;
        }

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
 * Converts user's local wake time to UTC using moment-timezone
 * Handles ALL timezones and DST automatically
 */
function convertLocalTimeToUTC(
  localTime: string, // e.g., "21:44"
  timezone: string    // e.g., "Europe/Athens"
): { hours: number; minutes: number } {
  try {
    // Parse wake time (HH:MM format)
    const [hours, minutes] = localTime.split(':').map(Number);

    // Set today's date with user's wake time in their timezone
    const localWakeTime = moment.tz(timezone)
      .hours(hours)
      .minutes(minutes)
      .seconds(0);

    // Convert to UTC
    const utcTime = localWakeTime.utc();

    console.log(`🌍 Timezone conversion: ${localTime} ${timezone} → ${utcTime.format('HH:mm')} UTC`);

    return {
      hours: utcTime.hours(),
      minutes: utcTime.minutes()
    };
  } catch (error) {
    console.error(`❌ Error converting timezone ${timezone}:`, error);
    // Fallback: assume UTC if timezone is invalid
    const [hours, minutes] = localTime.split(':').map(Number);
    return { hours, minutes };
  }
}
