// app/types/dreamJob.ts
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface DreamJob {
  id: string;
  userId: string;
  prompt: string;
  selectedImages?: string[]; // Optional Cloudinary URLs
  settings: {
    model: 'kling' | 'dreamCinema';
    duration: number;
    aspectRatio: string;
    scenes: number;
  };
  status: JobStatus;
  progress: number;
  currentStep: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  metadata?: any;
  createdAt: number;
  updatedAt: number;
}

export interface CreateJobInput {
  userId: string;
  prompt: string;
  selectedImages?: string[]; // Optional Cloudinary URLs
  settings: {
    model: 'kling' | 'dreamCinema';
    duration: number;
    aspectRatio: string;
    scenes: number;
  };
}