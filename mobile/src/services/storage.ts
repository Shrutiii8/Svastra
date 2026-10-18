/**
 * HeatGuard Twin — Cross-platform Storage Service
 *
 * Provides persistent key-value storage using SecureStore on native devices (iOS/Android)
 * and localStorage on Web, where SecureStore is not supported.
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export async function getStorageItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      return null;
    }
    return null;
  }
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setStorageItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (err) {
      console.warn('[Storage] localStorage.setItem failed:', err);
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.warn('[Storage] SecureStore.setItemAsync failed:', err);
  }
}

export async function deleteStorageItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (err) {
      console.warn('[Storage] localStorage.removeItem failed:', err);
    }
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.warn('[Storage] SecureStore.deleteItemAsync failed:', err);
  }
}
