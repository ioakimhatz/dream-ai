// app/services/syncService.ts - Sync completed videos from Firestore to AsyncStorage
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { firestore } from '../config/firebaseConfig';
import { getDreams, saveDream, type DreamItem } from '../utils/storage';
import { DreamJob } from '../types/dreamJob';

/**
 * Sync completed dream jobs from Firestore to local AsyncStorage
 * This ensures users always see their videos even if they closed the app during generation
 */
export async function syncDreamsFromFirestore(userId: string): Promise<void> {
  try {
    console.log('🔄 [syncService] Starting sync for user:', userId);

    // Step 1: Query Firestore for all completed dream jobs for this user
    const jobsRef = collection(firestore, 'dreamJobs');
    const q = query(
      jobsRef,
      where('userId', '==', userId),
      where('status', '==', 'completed'),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    console.log(`📥 [syncService] Found ${querySnapshot.size} completed jobs in Firestore`);

    if (querySnapshot.empty) {
      console.log('✅ [syncService] No completed jobs to sync');
      return;
    }

    // Step 2: Convert Firestore dreamJobs to DreamItems
    const firestoreDreams: DreamItem[] = [];
    querySnapshot.forEach((doc) => {
      const job = doc.data() as DreamJob;

      // Only sync jobs that have a videoUrl (completed and have actual video)
      if (job.videoUrl) {
        const dreamItem: DreamItem = {
          id: job.id,
          prompt: job.prompt,
          videoUrl: job.videoUrl,
          thumbnailUrl: job.thumbnailUrl || null,
          createdAt: job.createdAt,
          duration: job.settings?.duration || 15,
          clips: job.metadata?.videoUrls || null, // If multiple clips exist
        };
        firestoreDreams.push(dreamItem);
        console.log(`  ✅ [syncService] Mapped job ${job.id}: ${job.prompt.substring(0, 50)}...`);
        console.log(`     📸 thumbnailUrl: ${job.thumbnailUrl ? 'EXISTS' : 'NULL'}`);
      } else {
        console.log(`  ⚠️ [syncService] Skipping job ${job.id} - no videoUrl`);
      }
    });

    if (firestoreDreams.length === 0) {
      console.log('⚠️ [syncService] No videos to sync (all jobs missing videoUrl)');
      return;
    }

    // Step 3: Get existing dreams from AsyncStorage
    const existingDreams = await getDreams();
    console.log(`📱 [syncService] Found ${existingDreams.length} existing dreams in AsyncStorage`);

    // Step 4: Merge and de-duplicate by ID
    // Create a Map to ensure unique IDs (Firestore takes precedence as source of truth)
    const dreamMap = new Map<string, DreamItem>();

    // First, add existing dreams
    existingDreams.forEach((dream) => {
      dreamMap.set(dream.id, dream);
    });

    // Then, add/overwrite with Firestore dreams (they are the source of truth)
    // 🔥 SMART MERGE: Preserve local thumbnailUrl if Firestore doesn't have one
    let newDreamsCount = 0;
    let updatedDreamsCount = 0;
    firestoreDreams.forEach((dream) => {
      const existing = dreamMap.get(dream.id);

      if (existing) {
        // Dream exists locally - merge intelligently
        const merged: DreamItem = {
          ...dream,  // Use Firestore data as base
          // 🔥 Preserve local thumbnailUrl if Firestore doesn't have one
          thumbnailUrl: dream.thumbnailUrl || existing.thumbnailUrl,
        };

        // 🔍 Debug logging for thumbnail preservation
        if (!dream.thumbnailUrl && existing.thumbnailUrl) {
          console.log(`  🔄 [syncService] Preserved local thumbnail for ${dream.id}`);
        }

        dreamMap.set(dream.id, merged);
        updatedDreamsCount++;
      } else {
        // New dream from Firestore
        dreamMap.set(dream.id, dream);
        newDreamsCount++;
      }
    });

    // Step 5: Convert back to array and sort by createdAt (newest first)
    const mergedDreams = Array.from(dreamMap.values()).sort(
      (a, b) => b.createdAt - a.createdAt
    );

    console.log(`🔄 [syncService] Merge results:`);
    console.log(`   📊 Total dreams after merge: ${mergedDreams.length}`);
    console.log(`   🆕 New dreams from Firestore: ${newDreamsCount}`);
    console.log(`   🔄 Updated dreams from Firestore: ${updatedDreamsCount}`);

    // Step 6: Save merged list back to AsyncStorage
    // We need to clear and re-save the entire array since we're merging
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const STORAGE_KEYS = require('../utils/storage').STORAGE_KEYS;
    await AsyncStorage.setItem(STORAGE_KEYS.DREAMS, JSON.stringify(mergedDreams));

    console.log('✅ [syncService] Sync completed successfully!');

    // Log the first few dreams for debugging
    if (newDreamsCount > 0) {
      console.log('🎬 [syncService] Newly synced dreams:');
      firestoreDreams.slice(0, 3).forEach((dream, index) => {
        if (!existingDreams.find(d => d.id === dream.id)) {
          console.log(`   ${index + 1}. ${dream.prompt.substring(0, 60)}...`);
        }
      });
    }

  } catch (error: any) {
    console.error('❌ [syncService] Error syncing dreams from Firestore:', error);

    // Don't throw - we don't want sync failures to break the app
    // The user can still see their locally cached dreams
    if (error.code === 'permission-denied') {
      console.error('⚠️ [syncService] Permission denied - check Firestore rules');
    } else if (error.code === 'failed-precondition') {
      console.error('⚠️ [syncService] Firestore index needed - check Firebase console');
    }
  }
}

/**
 * Check if a specific job exists in local storage
 * Used to determine if we need to sync a specific video
 */
export async function isDreamSynced(jobId: string): Promise<boolean> {
  try {
    const dreams = await getDreams();
    return dreams.some(dream => dream.id === jobId);
  } catch (error) {
    console.error('❌ [syncService] Error checking if dream is synced:', error);
    return false;
  }
}

/**
 * Sync a single specific job from Firestore to AsyncStorage
 * Useful when we know a specific job completed but wasn't synced
 */
export async function syncSingleDream(jobId: string): Promise<void> {
  try {
    console.log(`🔄 [syncService] Syncing single dream: ${jobId}`);

    const { getDreamJob } = await import('./firestoreService');
    const job = await getDreamJob(jobId);

    if (!job) {
      console.log(`⚠️ [syncService] Job ${jobId} not found in Firestore`);
      return;
    }

    if (job.status !== 'completed' || !job.videoUrl) {
      console.log(`⚠️ [syncService] Job ${jobId} is not completed or has no video`);
      return;
    }

    const dreamItem: DreamItem = {
      id: job.id,
      prompt: job.prompt,
      videoUrl: job.videoUrl,
      thumbnailUrl: job.thumbnailUrl || null,
      createdAt: job.createdAt,
      duration: job.settings?.duration || 15,
      clips: job.metadata?.videoUrls || null,
    };

    await saveDream(dreamItem);
    console.log(`✅ [syncService] Single dream synced: ${jobId}`);
  } catch (error) {
    console.error(`❌ [syncService] Error syncing single dream ${jobId}:`, error);
  }
}
