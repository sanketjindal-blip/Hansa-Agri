import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Safe AsyncStorage wrapper that never throws. If the native module is
 * unavailable (e.g. Expo Go version mismatch) we silently fall back to an
 * in-memory Map so the app keeps running.
 */
const memory = new Map<string, string>();

export const storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return memory.has(key) ? memory.get(key)! : null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    memory.set(key, value);
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      /* swallow */
    }
  },
  async removeItem(key: string): Promise<void> {
    memory.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      /* swallow */
    }
  },
};
