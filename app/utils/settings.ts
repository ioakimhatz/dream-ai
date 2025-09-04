// app/utils/settings.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'settings.v1';

export type AppSettings = {
  notifications: boolean;
  language: 'en' | 'el' | 'de' | 'fr' | 'es' | string;
};

const DEFAULTS: AppSettings = { notifications: true, language: 'en' };

export async function getSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as AppSettings;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

export async function setSettings(patch: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}
