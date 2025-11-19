// functions/src/processDreamJob.ts - WITH SERVER-SIDE DREAM DEDUCTION
import * as admin from 'firebase-admin';
import { generateDreamVideo } from './utils/generateDreamVideo';
import { sendVideoReadyNotification, sendVideoFailedNotification } from './utils/sendNotification';

export async function processDreamJob(
  jobId: string,
  jobData: any,
  jobRef: admin.firestore.DocumentReference
): Promise<void> {

  console.log(`🎬 Processing dream job: ${jobId}`);
  console.log(`📝 Prompt: "${jobData.prompt}"`);
  console.log(`👥 Face images: ${jobData.selectedImages?.length || 0}`);

  if (!process.env.EXPO_PUBLIC_FAL_KEY) {
    throw new Error('EXPO_PUBLIC_FAL_KEY not loaded from .env file');
  }

  if (!process.env.EXPO_PUBLIC_OPENAI_API_KEY) {
    throw new Error('EXPO_PUBLIC_OPENAI_API_KEY not loaded from .env file');
  }

  console.log('✅ Environment variables are loaded and ready');

  // 🔥 CRITICAL: Deduct dream BEFORE processing starts (server-side, atomic)
  const db = admin.firestore();
  let dreamDeducted = false;

  try {
    console.log('💰 Checking dream availability for user:', jobData.userId);

    await db.runTransaction(async (transaction) => {
      const usageRef = db.collection('dreamUsage').doc(jobData.userId);
      const usageDoc = await transaction.get(usageRef);

      // Check if user has dreams available
      if (!usageDoc.exists) {
        throw new Error('User dream usage not found. Please subscribe to generate dreams.');
      }

      const usageData = usageDoc.data()!;
      const used = usageData.used || 0;
      const total = usageData.total || 0;

      console.log(`📊 Current usage: ${used}/${total} dreams`);

      if (used >= total) {
        console.error(`❌ Insufficient dreams: ${used}/${total}`);
        throw new Error('No dreams available. Please purchase more to continue.');
      }

      // ✅ User has dreams - deduct one
      console.log(`✅ User has dreams available. Deducting 1 dream...`);

      transaction.update(usageRef, {
        used: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create audit entry in dreamGenerations collection
      const generationRef = db.collection('dreamGenerations').doc(jobId);
      transaction.set(generationRef, {
        userId: jobData.userId,
        jobId: jobId,
        prompt: jobData.prompt,
        deducted: true,
        refunded: false,
        deductedAt: admin.firestore.FieldValue.serverTimestamp(),
        refundedAt: null,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      dreamDeducted = true;
      console.log(`✅ Dream deducted! New usage: ${used + 1}/${total}`);
    });

  } catch (error: any) {
    console.error('❌ Failed to deduct dream:', error.message);

    // Update job status to failed
    await jobRef.update({
      status: 'failed',
      error: error.message || 'Insufficient dreams',
      currentStep: 'Failed - Dream deduction error',
      updatedAt: Date.now(),
      metadata: {
        shouldRefund: false,
        errorType: 'INSUFFICIENT_DREAMS',
      },
    });

    // Send failure notification
    await sendVideoFailedNotification(
      jobData.userId,
      jobId,
      error.message || 'Failed to deduct dream'
    );

    throw error;
  }

  try {
    const onProgress = async (step: string, progress: number) => {
      await jobRef.update({
        progress,
        currentStep: step,
        updatedAt: Date.now(),
      });
      console.log(`[${progress}%] ${step}`);
    };

    const result = await generateDreamVideo(
      jobData.prompt,
      jobData.selectedImages || undefined,
      onProgress,
      jobData.userId
    );

    console.log(`✅ Generation complete!`);

    // 🔥 FIXED: Use thumbnailUrl from generation result (last frame for dreamcore, first scene for standard)
    const thumbnailUrl = result.thumbnailUrl || result.coverUrl || null;
    console.log(`🖼️ Thumbnail URL: ${thumbnailUrl}`);

    await jobRef.update({
      status: 'completed',
      progress: 100,
      currentStep: 'Completed!',
      videoUrl: result.videoUrls[0],
      thumbnailUrl: thumbnailUrl,  // ✅ Use last frame (dreamcore) or first scene (standard) as thumbnail
      updatedAt: Date.now(),
      metadata: {
        videoUrls: result.videoUrls,
        refundUser: result.refundUser || false,
        partialSuccess: result.partialSuccess || false,
      },
    });

    // 🔥 NEW: Update audit entry to completed
    const generationRef = db.collection('dreamGenerations').doc(jobId);
    await generationRef.update({
      status: 'completed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`✅ Job ${jobId} completed!`);

    // 🔥 NEW: Send FCM push notification to user
    console.log(`📱 Sending push notification to user ${jobData.userId}...`);
    await sendVideoReadyNotification(
      jobData.userId,
      result.videoUrls[0],
      jobId
    );

  } catch (error: any) {
    console.error(`❌ Error:`, error);

    const shouldRefund = error.refundUser === true;

    const metadata: any = {
      shouldRefund,
    };

    if (error.errorType !== undefined) {
      metadata.errorType = error.errorType;
    }

    await jobRef.update({
      status: 'failed',
      error: error.message || 'Generation failed',
      currentStep: 'Failed',
      updatedAt: Date.now(),
      metadata,
    });

    // 🔥 CRITICAL: Refund dream if it was deducted and generation failed
    if (dreamDeducted) {
      console.log('💸 Refunding dream to user...');

      try {
        await db.runTransaction(async (transaction) => {
          const usageRef = db.collection('dreamUsage').doc(jobData.userId);
          const usageDoc = await transaction.get(usageRef);

          if (usageDoc.exists) {
            const usageData = usageDoc.data()!;
            const used = usageData.used || 0;

            // Only refund if user has used dreams
            if (used > 0) {
              transaction.update(usageRef, {
                used: admin.firestore.FieldValue.increment(-1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              // Update audit entry to refunded
              const generationRef = db.collection('dreamGenerations').doc(jobId);
              transaction.update(generationRef, {
                refunded: true,
                refundedAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'failed',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              });

              console.log(`✅ Dream refunded! New usage: ${used - 1}/${usageData.total || 0}`);
            } else {
              console.warn('⚠️ Cannot refund - usage is already 0');
            }
          }
        });
      } catch (refundError) {
        console.error('❌ Failed to refund dream:', refundError);
        // Don't throw - we've already failed, just log the refund error
      }
    } else {
      console.log('ℹ️ No dream to refund (deduction failed or not attempted)');

      // Update audit entry to failed (if it exists)
      try {
        const generationRef = db.collection('dreamGenerations').doc(jobId);
        const generationDoc = await generationRef.get();

        if (generationDoc.exists) {
          await generationRef.update({
            status: 'failed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      } catch (auditError) {
        console.error('❌ Failed to update audit entry:', auditError);
      }
    }

    // 🔥 NEW: Send FCM push notification to user about failure
    console.log(`📱 Sending failure notification to user ${jobData.userId}...`);
    await sendVideoFailedNotification(
      jobData.userId,
      jobId,
      error.message || 'Generation failed'
    );

    throw error;
  }
}