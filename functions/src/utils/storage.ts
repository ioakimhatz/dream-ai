// functions/src/utils/storage.ts - COMPLETE & FIXED
import * as admin from 'firebase-admin';

// Dream item interface - matches app version
export interface DreamItem {
  id: string;
  prompt: string;
  videoUrl?: string | null;
  thumbnailUrl?: string | null; // For Cloudinary thumbnails
  coverUrl?: string | null;
  createdAt: number;
  duration?: number; // 🔥 FIXED - Added duration property
  clips?: string[] | null;
}

// User interface
export interface User {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  bio?: string;
  dreamCount?: number;
}

// Constants
export const STORAGE_KEYS = {
  DREAMS: '@dreams',
  USER: '@user_data',
  NOTIFICATIONS: 'notifications',
  LANGUAGE: 'selectedLanguage',
} as const;

// Note: Cloud Functions use Firestore instead of AsyncStorage
// These functions are here for type compatibility but not used directly

// Dream management functions (Firestore-based)
export const saveDream = async (dream: DreamItem): Promise<void> => {
  try {
    const db = admin.firestore();
    await db.collection('dreams').doc(dream.id).set(dream);
  } catch (error) {
    console.error('Failed to save dream:', error);
    throw error;
  }
};

export const getDreams = async (userId: string): Promise<DreamItem[]> => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection('dreams')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => doc.data() as DreamItem);
  } catch (error) {
    console.error('Failed to get dreams:', error);
    return [];
  }
};

export const deleteDream = async (dreamId: string): Promise<void> => {
  try {
    const db = admin.firestore();
    await db.collection('dreams').doc(dreamId).delete();
  } catch (error) {
    console.error('Failed to delete dream:', error);
    throw error;
  }
};

// User management functions (Firestore-based)
export const saveUser = async (user: User): Promise<void> => {
  try {
    const db = admin.firestore();
    await db.collection('users').doc(user.id).set(user, { merge: true });
  } catch (error) {
    console.error('Failed to save user:', error);
    throw error;
  }
};

export const getUser = async (userId: string): Promise<User | null> => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('users').doc(userId).get();
    return doc.exists ? doc.data() as User : null;
  } catch (error) {
    console.error('Failed to get user:', error);
    return null;
  }
};

export const deleteUser = async (userId: string): Promise<void> => {
  try {
    const db = admin.firestore();
    await db.collection('users').doc(userId).delete();
  } catch (error) {
    console.error('Failed to delete user:', error);
    throw error;
  }
};

// Settings management functions (Firestore-based)
export const saveNotificationSetting = async (userId: string, enabled: boolean): Promise<void> => {
  try {
    const db = admin.firestore();
    await db.collection('users').doc(userId).update({ notificationsEnabled: enabled });
  } catch (error) {
    console.error('Failed to save notification setting:', error);
    throw error;
  }
};

export const getNotificationSetting = async (userId: string): Promise<boolean> => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('users').doc(userId).get();
    return doc.exists ? doc.data()?.notificationsEnabled ?? true : true;
  } catch (error) {
    console.error('Failed to get notification setting:', error);
    return true;
  }
};

export const saveLanguageSetting = async (userId: string, language: string): Promise<void> => {
  try {
    const db = admin.firestore();
    await db.collection('users').doc(userId).update({ language });
  } catch (error) {
    console.error('Failed to save language setting:', error);
    throw error;
  }
};

export const getLanguageSetting = async (userId: string): Promise<string> => {
  try {
    const db = admin.firestore();
    const doc = await db.collection('users').doc(userId).get();
    return doc.exists ? doc.data()?.language ?? 'English' : 'English';
  } catch (error) {
    console.error('Failed to get language setting:', error);
    return 'English';
  }
};

// Utility functions
export const createMockUser = (): User => ({
  id: Date.now().toString(),
  name: 'Dream Creator',
  email: 'user@dreamai.app',
  bio: 'Dream creator and AI enthusiast ✨',
  dreamCount: Math.floor(Math.random() * 25) + 5,
});

export const createMockDream = (prompt: string): DreamItem => ({
  id: Date.now().toString(),
  prompt,
  createdAt: Date.now(),
  duration: 8, // 🔥 FIXED - Now works because duration is in the type
  coverUrl: null,
  thumbnailUrl: null,
  videoUrl: null,
  clips: null,
});

// Clear all data for a user
export const clearUserData = async (userId: string): Promise<void> => {
  try {
    const db = admin.firestore();
    
    // Delete all dreams
    const dreamsSnapshot = await db.collection('dreams')
      .where('userId', '==', userId)
      .get();
    
    const batch = db.batch();
    dreamsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete user document
    batch.delete(db.collection('users').doc(userId));
    
    await batch.commit();
  } catch (error) {
    console.error('Failed to clear user data:', error);
    throw error;
  }
};

// Get app statistics for a user
export const getAppStats = async (userId: string): Promise<{
  dreamCount: number;
  totalDuration: number;
  userExists: boolean;
}> => {
  try {
    const dreams = await getDreams(userId);
    const user = await getUser(userId);
    
    return {
      dreamCount: dreams.length,
      totalDuration: dreams.reduce((total, dream) => total + (dream.duration || 0), 0), // 🔥 FIXED - Now works
      userExists: !!user,
    };
  } catch (error) {
    console.error('Failed to get app stats:', error);
    return {
      dreamCount: 0,
      totalDuration: 0,
      userExists: false,
    };
  }
};

// Export supported languages
export const SUPPORTED_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 
  'Portuguese', 'Russian', 'Japanese', 'Korean', 
  'Chinese (Simplified)', 'Chinese (Traditional)'
];

// Export for backward compatibility
export default {
  saveDream,
  getDreams,
  deleteDream,
  saveUser,
  getUser,
  deleteUser,
  saveNotificationSetting,
  getNotificationSetting,
  saveLanguageSetting,
  getLanguageSetting,
  createMockUser,
  createMockDream,
  clearUserData,
  getAppStats,
  SUPPORTED_LANGUAGES,
};