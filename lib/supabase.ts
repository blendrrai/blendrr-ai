import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

// Both values are public-safe (anon key is RLS-protected on the server).
// We read from app.json's `extra` block because env-var inlining via Metro
// is unreliable in EAS production builds. The env var stays as a fallback
// for local development.
const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl || '';
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey || '';

if (!URL || !KEY) {
  console.warn('[supabase] URL or anon key missing — set in app.json `extra` or .env.local');
}

export const supabase = createClient(URL, KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    // Explicit anon key as Authorization header on EVERY request,
    // so functions.invoke() works even before any session is established.
    headers: {
      Authorization: `Bearer ${KEY}`,
      apikey: KEY,
    },
  },
});
