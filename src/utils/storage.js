import * as SecureStore from 'expo-secure-store';

export const storage = {
  setItem: async (key, value) => {
    console.log(key,value,"asdsadsad")
    try {
      await SecureStore.setItemAsync(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error saving data', error);
      return false;
    }
  },

  getItem: async (key) => {
    try {
      const result = await SecureStore.getItemAsync(key);
      return result ? JSON.parse(result) : null;
    } catch (error) {
      console.error('Error getting data', error);
      return null;
    }
  },

  removeItem: async (key) => {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (error) {
      console.error('Error removing data', error);
      return false;
    }
  },

  clear: async () => {
    try {
      // Note: SecureStore doesn't have clear all, implement if needed
      return true;
    } catch (error) {
      console.error('Error clearing data', error);
      return false;
    }
  },
};