// app/services/healthKitService.ts - Updated to use @kingstinct/react-native-healthkit
import { Platform } from 'react-native';
import {
  requestAuthorization,
  queryCategorySamples,
  CategoryValueSleepAnalysis
} from '@kingstinct/react-native-healthkit';

export interface SleepSchedule {
  weekday: {
    bedtime: string; // HH:MM format
    wakeup: string; // HH:MM format
  };
  weekend: {
    bedtime: string;
    wakeup: string;
  };
}

/**
 * Request HealthKit permission for sleep data
 */
export async function requestHealthKitPermission(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    console.log('⚠️ HealthKit only available on iOS');
    return false;
  }

  try {
    const status = await requestAuthorization({
      toRead: ['HKCategoryTypeIdentifierSleepAnalysis'],
    });

    if (status) {
      console.log('✅ HealthKit permission granted');
      return true;
    } else {
      console.error('❌ HealthKit permission denied');
      return false;
    }
  } catch (error) {
    console.error('❌ HealthKit permission error:', error);
    return false;
  }
}

/**
 * Check if HealthKit is available on this device
 */
export function isHealthKitAvailable(): boolean {
  return Platform.OS === 'ios';
}

/**
 * Get sleep schedule from last 7 days
 * Analyzes sleep data to determine weekday vs weekend wake times
 */
export async function getSleepSchedule(): Promise<SleepSchedule | null> {
  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 7);

    const samples = await queryCategorySamples(
      'HKCategoryTypeIdentifierSleepAnalysis',
      {
        filter: {
          date: {
            startDate: sevenDaysAgo,
            endDate: now,
          }
        },
        ascending: false,
        limit: 100,
      }
    );

    if (!samples || samples.length === 0) {
      console.log('📭 No sleep data found');
      return null;
    }

    console.log(`📊 Found ${samples.length} sleep samples`);

    // Separate weekday and weekend sleep sessions
    const weekdaySessions: Date[] = [];
    const weekendSessions: Date[] = [];

    for (const sample of samples) {
      // Filter for "Asleep" samples (when they wake up is the end date)
      if (sample.value === CategoryValueSleepAnalysis.asleepUnspecified ||
          sample.value === CategoryValueSleepAnalysis.asleepCore ||
          sample.value === CategoryValueSleepAnalysis.asleepDeep ||
          sample.value === CategoryValueSleepAnalysis.asleepREM ||
          sample.value === CategoryValueSleepAnalysis.inBed) {
        const endDate = new Date(sample.endDate);
        const dayOfWeek = endDate.getDay();

        // 0 = Sunday, 6 = Saturday
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          weekendSessions.push(endDate);
        } else {
          weekdaySessions.push(endDate);
        }
      }
    }

    // Calculate average wake times
    const weekdayWakeup = calculateAverageTime(weekdaySessions);
    const weekendWakeup = calculateAverageTime(weekendSessions);

    // Use same time for bedtime (can be enhanced later)
    const schedule: SleepSchedule = {
      weekday: {
        bedtime: '23:00',
        wakeup: weekdayWakeup || '07:00',
      },
      weekend: {
        bedtime: '00:00',
        wakeup: weekendWakeup || '09:00',
      },
    };

    console.log('✅ Sleep schedule detected:', schedule);
    return schedule;
  } catch (error) {
    console.error('❌ Error reading sleep data:', error);
    return null;
  }
}

/**
 * Calculate average time from array of dates
 * Returns HH:MM format
 */
function calculateAverageTime(dates: Date[]): string | null {
  if (dates.length === 0) {
    return null;
  }

  // Convert all dates to minutes since midnight
  const minutesArray = dates.map(date => {
    return date.getHours() * 60 + date.getMinutes();
  });

  // Calculate average
  const avgMinutes = Math.round(
    minutesArray.reduce((sum, min) => sum + min, 0) / minutesArray.length
  );

  // Convert back to HH:MM
  const hours = Math.floor(avgMinutes / 60);
  const minutes = avgMinutes % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Get simple wake time (just the time user typically wakes up)
 * Uses current day's day of week to determine weekday vs weekend
 */
export async function getWakeTime(): Promise<string | null> {
  const schedule = await getSleepSchedule();

  if (!schedule) {
    return null;
  }

  // Check if today is weekend
  const today = new Date().getDay();
  const isWeekend = today === 0 || today === 6;

  return isWeekend ? schedule.weekend.wakeup : schedule.weekday.wakeup;
}
