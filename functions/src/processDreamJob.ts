// functions/src/processDreamJob.ts - WITH THUMBNAIL FROM SCENE IMAGE
import * as admin from 'firebase-admin';
import { generateDreamVideo } from './utils/generateDreamVideo';

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

    // 🔥 FIXED: Use coverUrl (which is the first scene image) as thumbnail
    const thumbnailUrl = result.coverUrl || null;
    console.log(`🖼️ Thumbnail URL: ${thumbnailUrl}`);

    await jobRef.update({
      status: 'completed',
      progress: 100,
      currentStep: 'Completed!',
      videoUrl: result.videoUrls[0],
      thumbnailUrl: thumbnailUrl,  // ✅ Use scene image as thumbnail
      updatedAt: Date.now(),
      metadata: {
        videoUrls: result.videoUrls,
        refundUser: result.refundUser || false,
        partialSuccess: result.partialSuccess || false,
      },
    });

    console.log(`✅ Job ${jobId} completed!`);

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

    throw error;
  }
}