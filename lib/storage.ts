import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Zone } from './theme';

const HISTORY_KEY = 'blendrr.history.v1';

export type TryOn = {
  id: string;
  createdAt: number;
  zone: Zone;
  selfieUri: string;
  productUri: string;
  productUrl: string | null;
  resultUri: string | null;
};

export async function loadHistory(): Promise<TryOn[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as TryOn[];
  } catch {
    return [];
  }
}

export async function saveTryOn(entry: TryOn): Promise<void> {
  const list = await loadHistory();
  const next = [entry, ...list].slice(0, 50);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export async function deleteTryOn(id: string): Promise<void> {
  const list = await loadHistory();
  const next = list.filter((t) => t.id !== id);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY);
}
