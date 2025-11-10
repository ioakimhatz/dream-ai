// functions/src/index.ts
import * as dotenv from 'dotenv';

// 🔥 CRITICAL: Load .env BEFORE anything else!
dotenv.config();

console.log('✅ Environment variables loaded from .env');

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Import the dream generation function
import { processDreamJob } from './processDreamJob';

/**
 * Cloud Function triggered when a new dream job is created
 */
export const onDreamJobCreated = functions
  .region('europe-west1')
  .runWith({
    timeoutSeconds: 540,  // 9 minutes
    memory: '1GB',
  })
  .firestore
  .document('dreamJobs/{jobId}')
  .onCreate(async (snapshot, context) => {
    const jobId = context.params.jobId;
    const job = snapshot.data();

    console.log(`🔥 New dream job created: ${jobId}`);

    if (job.status !== 'pending') {
      console.log(`⏭️ Job ${jobId} status is ${job.status}, skipping...`);
      return null;
    }

    try {
      await snapshot.ref.update({
        status: 'processing',
        progress: 5,
        currentStep: 'Starting generation...',
        updatedAt: Date.now(),
      });

      await processDreamJob(jobId, job, snapshot.ref);

      console.log(`✅ Dream job ${jobId} completed successfully`);
      return null;

    } catch (error: any) {
      console.error(`❌ Error processing job ${jobId}:`, error);

      await snapshot.ref.update({
        status: 'failed',
        error: error.message || 'Unknown error occurred',
        currentStep: 'Failed',
        updatedAt: Date.now(),
      });

      return null;
    }
  });
