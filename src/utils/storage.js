import * as SecureStore from 'expo-secure-store';

export const storage = {
  setItem: async (key, value) => {
    try {
      await SecureStore.setItemAsync(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  },

  getItem: async (key) => {
    try {
      const result = await SecureStore.getItemAsync(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      return null;
    }
  },

  removeItem: async (key) => {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (error) {
      return false;
    }
  },

  clear: async () => {
    try {
      return true;
    } catch (error) {
      return false;
    }
  },
};