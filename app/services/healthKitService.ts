// app/services/healthKitService.ts
import { Platform } from 'react-native';
import AppleHealthKit, {
  HealthValue,
  HealthKitPermissions,
} from 'react-native-health';

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

// HealthKit permissions we need
const permissions: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
    ],
    write: [],
  },
};

/**
 * Request HealthKit permission for sleep data
 */
export async function requestHealthKitPermission(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    console.log('⚠️ HealthKit only available on iOS');
    return false;
  }

  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(permissions, (error: string) => {
      if (error) {
        console.error('❌ HealthKit permission error:', error);
        resolve(false);
      } else {
        console.log('✅ HealthKit permission granted');
        resolve(true);
      }
    });
  });
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

  return new Promise((resolve) => {
    const options = {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      endDate: new Date().toISOString(),
    };

    AppleHealthKit.getSleepSamples(options, (error: string, results: any[]) => {
      if (error) {
        console.error('❌ Error reading sleep data:', error);
        resolve(null);
        return;
      }

      if (!results || results.length === 0) {
        console.log('📭 No sleep data found');
        resolve(null);
        return;
      }

      console.log(`📊 Found ${results.length} sleep samples`);

      // Separate weekday and weekend sleep sessions
      const weekdaySessions: Date[] = [];
      const weekendSessions: Date[] = [];

      for (const sample of results) {
        // Filter for "InBed" or "Asleep" samples
        if (sample.value === 'INBED' || sample.value === 'ASLEEP') {
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
      resolve(schedule);
    });
  });
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
