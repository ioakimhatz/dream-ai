// app/utils/testFirestore.ts
import { createDreamJob, getDreamJob, subscribeToJob } from '../services/firestoreService';

/**
 * Test function to verify Firestore is working
 */
export const testFirestoreSetup = async (userId: string) => {
  try {
    console.log('🧪 Testing Firestore setup...');

    // 1. Create a test job
    const jobId = await createDreamJob({
      userId,
      prompt: 'Test dream: A magical forest',
      settings: {
        model: 'kling',
        duration: 5,
        aspectRatio: '16:9',
        scenes: 3,
      },
    });

    console.log('✅ Test job created:', jobId);

    // 2. Read the job back
    const job = await getDreamJob(jobId);
    console.log('✅ Test job retrieved:', job);

    // 3. Subscribe to updates
    const unsubscribe = subscribeToJob(jobId, (updatedJob) => {
      console.log('🔄 Job updated:', updatedJob);
    });

    // Clean up after 5 seconds
    setTimeout(() => {
      unsubscribe();
      console.log('✅ Firestore test complete!');
    }, 5000);

    return jobId;
  } catch (error) {
    console.error('❌ Firestore test failed:', error);
    throw error;
  }
};