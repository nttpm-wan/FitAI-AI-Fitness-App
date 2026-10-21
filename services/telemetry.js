import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { getCurrentUser, isSupabaseConfigured, supabase } from "../firebase/config";

const EVENT_LOG_KEY = "fitai_event_log_v1";
const MAX_LOCAL_EVENTS = 200;

export async function trackEvent(eventName, properties = {}, level = "info") {
  const event = {
    id: Crypto.randomUUID(),
    event_name: String(eventName).slice(0, 100),
    level,
    properties,
    created_at: new Date().toISOString(),
  };

  try {
    const current = JSON.parse((await AsyncStorage.getItem(EVENT_LOG_KEY)) || "[]");
    await AsyncStorage.setItem(EVENT_LOG_KEY, JSON.stringify([event, ...current].slice(0, MAX_LOCAL_EVENTS)));
  } catch (error) {
    console.warn("FITAI local event log write failed.", error.message);
  }

  if (isSupabaseConfigured) {
    try {
      const user = await getCurrentUser();
      if (user?.id) {
        const { error } = await supabase.from("analytics_events").insert({
          user_id: user.id,
          event_name: event.event_name,
          level,
          properties,
          created_at: event.created_at,
        });
        if (error) throw error;
      }
    } catch (error) {
      console.warn("FITAI remote event log write failed.", error.message);
    }
  }
}

export function trackScreen(screenName) {
  return trackEvent("screen_view", { screen: String(screenName || "unknown").slice(0, 80) });
}

export function trackCrash(error, context = "runtime") {
  const normalized = error instanceof Error ? error : new Error(String(error));
  return trackEvent("app_crash", {
    context,
    error_name: normalized.name,
  }, "error");
}

export function installGlobalErrorHandler() {
  const errorUtils = global.ErrorUtils;
  if (!errorUtils?.getGlobalHandler || !errorUtils?.setGlobalHandler) return () => {};

  const previousHandler = errorUtils.getGlobalHandler();
  const handler = (error, isFatal) => {
    void trackCrash(error, isFatal ? "fatal" : "global");
    previousHandler?.(error, isFatal);
  };
  errorUtils.setGlobalHandler(handler);
  return () => errorUtils.setGlobalHandler(previousHandler);
}
