// functions/src/types.ts
export interface DreamJob {
  id: string;
  userId: string;
  prompt: string;
  settings: {
    model: 'kling' | 'dreamCinema';
    duration: number;
    aspectRatio: string;
    scenes?: number;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  createdAt: number;
  updatedAt: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
  metadata?: {
    sceneImages?: string[];
    sceneVideos?: string[];
    cost?: number;
  };
}

export interface Scene {
  description: string;
  imageUrl?: string;
  videoUrl?: string;
}