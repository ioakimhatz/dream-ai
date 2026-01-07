import { useEffect, useState } from 'react';
import {
  requestAuthorization,
  queryCategorySamples,
  CategoryValueSleepAnalysis
} from '@kingstinct/react-native-healthkit';

export const useSleepData = () => {
  const [authorized, setAuthorized] = useState(false);
  const [wakeTime, setWakeTime] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPermissions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Request read permission for sleep analysis
      const status = await requestAuthorization({
        toRead: ['HKCategoryTypeIdentifierSleepAnalysis'],
      });

      if (status) {
        setAuthorized(true);
        await fetchSleepData();
      } else {
        setError('HealthKit permission denied');
      }
    } catch (err) {
      console.error('HealthKit authorization error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSleepData = async () => {
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
          limit: 50,
        }
      );

      // Find wake time from sleep segments
      const sleepSegments = samples.filter(
        (s) => s.value === CategoryValueSleepAnalysis.asleepUnspecified ||
               s.value === CategoryValueSleepAnalysis.asleepCore ||
               s.value === CategoryValueSleepAnalysis.asleepDeep ||
               s.value === CategoryValueSleepAnalysis.asleepREM ||
               s.value === CategoryValueSleepAnalysis.inBed
      );

      if (sleepSegments.length > 0) {
        const lastWakeUp = new Date(sleepSegments[0].endDate);
        setWakeTime(lastWakeUp);
        console.log('✅ Detected Wake Time:', lastWakeUp);
      } else {
        console.log('⚠️ No sleep data found in last 7 days');
      }
    } catch (err) {
      console.error('Failed to fetch sleep data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch sleep data');
    }
  };

  return {
    authorized,
    wakeTime,
    loading,
    error,
    requestPermissions
  };
};
