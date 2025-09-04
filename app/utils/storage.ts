// utils/storage.ts - COMPLETE VERSION WITH ALL FUNCTIONS
import AsyncStorage from '@react-native-async-storage/async-storage';

// Dream item interface (for library.tsx)
export interface DreamItem {
  id: string;
  prompt: string;
  videoUrl?: string | null;
  coverUrl?: string | null;
  createdAt: number;
  duration?: number;
  clips?: string[] | null; // Added clips property for video segments
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

// Dream management functions
export const saveDream = async (dream: DreamItem): Promise<void> => {
  try {
    const existingDreams = await getDreams();
    const updatedDreams = [dream, ...existingDreams];
    await AsyncStorage.setItem(STORAGE_KEYS.DREAMS, JSON.stringify(updatedDreams));
  } catch (error) {
    console.error('Failed to save dream:', error);
    throw error;
  }
};

export const getDreams = async (): Promise<DreamItem[]> => {
  try {
    const dreamsJson = await AsyncStorage.getItem(STORAGE_KEYS.DREAMS);
    return dreamsJson ? JSON.parse(dreamsJson) : [];
  } catch (error) {
    console.error('Failed to get dreams:', error);
    return [];
  }
};

export const deleteDream = async (dreamId: string): Promise<void> => {
  try {
    const dreams = await getDreams();
    const filteredDreams = dreams.filter(dream => dream.id !== dreamId);
    await AsyncStorage.setItem(STORAGE_KEYS.DREAMS, JSON.stringify(filteredDreams));
  } catch (error) {
    console.error('Failed to delete dream:', error);
    throw error;
  }
};

// User management functions
export const saveUser = async (user: User): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
  } catch (error) {
    console.error('Failed to save user:', error);
    throw error;
  }
};

export const getUser = async (): Promise<User | null> => {
  try {
    const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('Failed to get user:', error);
    return null;
  }
};

export const deleteUser = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.USER);
  } catch (error) {
    console.error('Failed to delete user:', error);
    throw error;
  }
};

// Settings management functions
export const saveNotificationSetting = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(enabled));
  } catch (error) {
    console.error('Failed to save notification setting:', error);
    throw error;
  }
};

export const getNotificationSetting = async (): Promise<boolean> => {
  try {
    const setting = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    return setting ? JSON.parse(setting) : true;
  } catch (error) {
    console.error('Failed to get notification setting:', error);
    return true;
  }
};

export const saveLanguageSetting = async (language: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
  } catch (error) {
    console.error('Failed to save language setting:', error);
    throw error;
  }
};

export const getLanguageSetting = async (): Promise<string> => {
  try {
    const setting = await AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE);
    return setting || 'English';
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
  duration: 8, // 8 seconds default
  coverUrl: null, // Will be set when video is generated
  videoUrl: null, // Will be set when video is generated
  clips: null, // Will be set when video segments are generated
});

// Clear all data
export const clearAllData = async (): Promise<void> => {
  try {
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.DREAMS,
      STORAGE_KEYS.USER,
      STORAGE_KEYS.NOTIFICATIONS,
      STORAGE_KEYS.LANGUAGE,
    ]);
  } catch (error) {
    console.error('Failed to clear data:', error);
    throw error;
  }
};

// Get app statistics
export const getAppStats = async (): Promise<{
  dreamCount: number;
  totalDuration: number;
  userExists: boolean;
}> => {
  try {
    const dreams = await getDreams();
    const user = await getUser();
    
    return {
      dreamCount: dreams.length,
      totalDuration: dreams.reduce((total, dream) => total + (dream.duration || 0), 0),
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

// Export for backward compatibility (if needed)
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
  clearAllData,
  getAppStats,
  SUPPORTED_LANGUAGES,
};