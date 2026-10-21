import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : {
      auth: {
        getSession: async () => {
          const user = await getLocalSession();
          return { data: { session: user ? { user } : null }, error: null };
        },
      },
    };

export const LOCAL_SESSION_KEY = "fitai_session_v1";

export async function getLocalSession() {
  if (!isSupabaseConfigured && !__DEV__) return null;
  try {
    const value = await AsyncStorage.getItem(LOCAL_SESSION_KEY);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  }
  return getLocalSession();
}

// Kept as a small compatibility layer for the supplied screens.
export const auth = { getCurrentUser };
