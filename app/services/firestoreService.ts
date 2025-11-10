// app/services/firestoreService.ts
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { firestore } from '../config/firebaseConfig';
import { DreamJob, CreateJobInput } from '../types/dreamJob';

const JOBS_COLLECTION = 'dreamJobs';

export const createDreamJob = async (input: CreateJobInput): Promise<string> => {
  try {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const jobRef = doc(firestore, JOBS_COLLECTION, jobId);

    const job: DreamJob = {
  id: jobId,
  userId: input.userId,
  prompt: input.prompt,
  ...(input.selectedImages && { selectedImages: input.selectedImages }), // ✅ Only add if exists!
  settings: input.settings,
  status: 'pending',
  progress: 0,
  currentStep: 'Waiting to start...',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};

    await setDoc(jobRef, job);
    console.log('✅ Dream job created:', jobId);
    return jobId;
  } catch (error) {
    console.error('❌ Error creating dream job:', error);
    throw error;
  }
};

export const getDreamJob = async (jobId: string): Promise<DreamJob | null> => {
  try {
    const jobRef = doc(firestore, JOBS_COLLECTION, jobId);
    const jobSnap = await getDoc(jobRef);
    if (jobSnap.exists()) {
      return jobSnap.data() as DreamJob;
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting dream job:', error);
    throw error;
  }
};

export const getUserDreamJobs = async (userId: string): Promise<DreamJob[]> => {
  try {
    const jobsRef = collection(firestore, JOBS_COLLECTION);
    const q = query(jobsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    const jobs: DreamJob[] = [];
    querySnapshot.forEach((doc) => {
      jobs.push(doc.data() as DreamJob);
    });
    return jobs;
  } catch (error) {
    console.error('❌ Error getting user dream jobs:', error);
    throw error;
  }
};

export const updateDreamJob = async (jobId: string, updates: Partial<DreamJob>): Promise<void> => {
  try {
    const jobRef = doc(firestore, JOBS_COLLECTION, jobId);
    await updateDoc(jobRef, { ...updates, updatedAt: Date.now() });
    console.log('✅ Dream job updated:', jobId);
  } catch (error) {
    console.error('❌ Error updating dream job:', error);
    throw error;
  }
};

export const deleteDreamJob = async (jobId: string): Promise<void> => {
  try {
    const jobRef = doc(firestore, JOBS_COLLECTION, jobId);
    await deleteDoc(jobRef);
    console.log('✅ Dream job deleted:', jobId);
  } catch (error) {
    console.error('❌ Error deleting dream job:', error);
    throw error;
  }
};

export const subscribeToJob = (
  jobId: string,
  onUpdate: (job: DreamJob) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const jobRef = doc(firestore, JOBS_COLLECTION, jobId);
  return onSnapshot(
    jobRef,
    (doc) => {
      if (doc.exists()) {
        onUpdate(doc.data() as DreamJob);
      }
    },
    (error) => {
      console.error('❌ Error in job subscription:', error);
      onError?.(error);
    }
  );
};

export const subscribeToUserJobs = (
  userId: string,
  onUpdate: (jobs: DreamJob[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const jobsRef = collection(firestore, JOBS_COLLECTION);
  const q = query(jobsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (querySnapshot) => {
      const jobs: DreamJob[] = [];
      querySnapshot.forEach((doc) => {
        jobs.push(doc.data() as DreamJob);
      });
      onUpdate(jobs);
    },
    (error) => {
      console.error('❌ Error in user jobs subscription:', error);
      onError?.(error);
    }
  );
};

export const completeJob = async (
  jobId: string,
  videoUrl: string,
  thumbnailUrl?: string,
  metadata?: any
): Promise<void> => {
  await updateDreamJob(jobId, {
    status: 'completed',
    progress: 100,
    currentStep: 'Completed!',
    videoUrl,
    thumbnailUrl,
    metadata,
  });
};

export const failJob = async (jobId: string, error: string): Promise<void> => {
  await updateDreamJob(jobId, {
    status: 'failed',
    currentStep: 'Failed',
    error,
  });
};