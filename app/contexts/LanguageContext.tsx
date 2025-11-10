// app/contexts/LanguageContext.tsx
// 🌍 Manages user's language preference for content filtering

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANGUAGE_STORAGE_KEY = 'user_language';

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => Promise<void>;
  isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Provider component that manages user's language preference
 * Stores selection in AsyncStorage for persistence
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState('en'); // Default to English
  const [isLoading, setIsLoading] = useState(true);

  // Load saved language on mount
  useEffect(() => {
    loadLanguage();
  }, []);

  /**
   * Load language from AsyncStorage
   */
  const loadLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved) {
        setLanguageState(saved);
        console.log('✅ Loaded language:', saved);
      } else {
        console.log('ℹ️ No saved language, using default: en');
      }
    } catch (error) {
      console.error('❌ Failed to load language:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Save new language preference
   */
  const setLanguage = async (lang: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      setLanguageState(lang);
      console.log('✅ Language saved:', lang);
    } catch (error) {
      console.error('❌ Failed to save language:', error);
      throw error;
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isLoading }}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook to access language context
 * @throws Error if used outside LanguageProvider
 */
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

/**
 * Supported languages and their display names
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number]['code'];