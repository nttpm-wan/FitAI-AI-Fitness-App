import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {
  getCurrentUser,
  isSupabaseConfigured,
  LOCAL_SESSION_KEY,
  supabase,
} from "./config";

const ACCOUNTS_KEY = "fitai_local_accounts_v1";
const listeners = new Set();

if (isSupabaseConfigured) {
  supabase.auth.onAuthStateChange((_event, session) => {
    for (const listener of listeners) listener(session?.user ?? null);
  });
}

function emit(user) {
  for (const listener of listeners) listener(user);
}

export function subscribeAuth(listener) {
  listeners.add(listener);
  getCurrentUser().then(listener).catch(() => listener(null));
  return () => listeners.delete(listener);
}

async function getAccounts() {
  try {
    return JSON.parse((await AsyncStorage.getItem(ACCOUNTS_KEY)) || "{}");
  } catch {
    return {};
  }
}

async function hashPassword(salt, password) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${password}`,
  );
}

export async function signIn(email, password) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    emit(data.user);
    return data.user;
  }

  if (!__DEV__) {
    throw new Error("Configure Supabase Auth before using accounts in a production build.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const account = (await getAccounts())[normalizedEmail];
  if (!account || (await hashPassword(account.salt, password)) !== account.passwordHash) {
    throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  }
  const user = { id: account.id, uid: account.id, email: normalizedEmail, ...account.profile };
  await AsyncStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user));
  emit(user);
  return user;
}

export async function signUp(email, password, name, age, gender) {
  if (isSupabaseConfigured) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, age: age || null, gender: gender || null } },
    });
    if (error) throw error;
    if (data.user && data.session) emit(data.user);
    return data;
  }

  if (!__DEV__) {
    throw new Error("Configure Supabase Auth before using accounts in a production build.");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const accounts = await getAccounts();
  if (accounts[normalizedEmail]) throw new Error("อีเมลนี้มีบัญชีแล้ว");
  const salt = Crypto.randomUUID();
  const id = Crypto.randomUUID();
  accounts[normalizedEmail] = {
    id,
    salt,
    passwordHash: await hashPassword(salt, password),
    profile: { name, age: age ? Number(age) : null, gender: gender || null },
  };
  await AsyncStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  return { user: { id, uid: id, email: normalizedEmail, name } };
}

export async function signOut() {
  if (isSupabaseConfigured) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } else {
    await AsyncStorage.removeItem(LOCAL_SESSION_KEY);
  }
  emit(null);
}

export { getCurrentUser };
