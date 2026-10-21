import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { getCurrentUser, isSupabaseConfigured, supabase } from "./config";

const CACHE_PREFIX = "fitai_data_v1:";
const postListeners = new Set();
const USER_PROFILE_FIELDS = new Set(["name", "age", "gender", "height", "weight", "handle"]);

const TABLE_BY_COLLECTION = {
  workouts: "workouts",
  goals: "goals",
  meals: "meals",
  progress: "progress",
  sleep: "sleep",
  notifications: "notifications",
  posts: "posts",
  challenges: "challenges",
  challenge_members: "challenge_members",
  settings: "settings",
  users: "users",
};

const demoChallenges = [
  { id: "72aa448a-5b88-4a72-8f10-2a1f1c500001", title: "7 วันเริ่มขยับ", desc: "สะสมการออกกำลังกายให้ครบ 7 วัน", category: "active", icon: "🔥", days_left: 7, reward: "Starter badge", progress: 0, members: 0 },
  { id: "72aa448a-5b88-4a72-8f10-2a1f1c500002", title: "เดินให้ครบ 50,000 ก้าว", desc: "ค่อย ๆ สะสมจำนวนก้าวในสัปดาห์นี้", category: "upcoming", icon: "👟", days_left: 5, reward: "Walker badge", progress: 0, members: 0 },
  { id: "72aa448a-5b88-4a72-8f10-2a1f1c500003", title: "ดื่มน้ำทุกวัน", desc: "บันทึกการดื่มน้ำต่อเนื่อง 5 วัน", category: "completed", icon: "💧", days_left: 0, reward: "Hydration badge", progress: 1, members: 0 },
];

const uidOf = (user) => (typeof user === "string" ? user : user?.id || user?.uid);
const cacheKey = (uid) => `${CACHE_PREFIX}${uid || "guest"}`;
const nowIso = () => new Date().toISOString();

async function readCache(uid) {
  try {
    return JSON.parse((await AsyncStorage.getItem(cacheKey(uid))) || "{}");
  } catch {
    return {};
  }
}

async function writeCache(uid, data) {
  await AsyncStorage.setItem(cacheKey(uid), JSON.stringify(data));
}

function normalizeRow(row = {}) {
  const normalized = { ...row };
  for (const [key, value] of Object.entries(row)) {
    const camel = key.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase());
    normalized[camel] = value;
  }
  normalized.user_id = normalized.user_id ?? normalized.userId;
  normalized.userId = normalized.userId ?? normalized.user_id;
  normalized.createdAt = normalized.createdAt ?? normalized.created_at;
  normalized.desc = normalized.desc ?? normalized.description;
  normalized.daysLeft = normalized.daysLeft ?? normalized.days_left;
  return normalized;
}

function toDatabaseRow(row = {}) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value]),
  );
}

function mergeById(remoteRows, localRows) {
  const merged = new Map();
  for (const row of remoteRows || []) merged.set(row.id, normalizeRow(row));
  for (const row of localRows || []) {
    if (!merged.has(row.id)) merged.set(row.id, normalizeRow(row));
  }
  return [...merged.values()].sort((a, b) => String(b.created_at || b.createdAt || "").localeCompare(String(a.created_at || a.createdAt || "")));
}

async function loadRows(collection, uid) {
  const cache = await readCache(uid);
  const localRows = cache[collection] || [];
  if (!isSupabaseConfigured || !uid) return localRows.map(normalizeRow);

  try {
    let query = supabase.from(TABLE_BY_COLLECTION[collection]).select("*");
    if (collection === "users") query = query.eq("id", uid).limit(1);
    else if (collection === "settings") query = query.eq("user_id", uid).limit(1);
    else if (collection === "challenges") query = query.order("created_at", { ascending: false });
    else if (collection === "posts") query = query.order("created_at", { ascending: false });
    else query = query.eq("user_id", uid).order("created_at", { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    if (data?.length) {
      cache[collection] = mergeById(data, localRows);
      await writeCache(uid, cache);
      return cache[collection].map(normalizeRow);
    }
  } catch (error) {
    console.warn(`FITAI ${collection} remote read failed; using local cache.`, error.message);
  }
  return localRows.map(normalizeRow);
}

async function saveRow(collection, uid, row, conflict = "id") {
  const cache = await readCache(uid);
  const rows = cache[collection] || [];
  const normalized = normalizeRow(row);
  const index = rows.findIndex((item) => item.id === normalized.id || (collection === "settings" && item.user_id === uid));
  if (index >= 0) rows[index] = { ...rows[index], ...normalized };
  else rows.unshift(normalized);
  cache[collection] = rows;
  await writeCache(uid, cache);

  if (isSupabaseConfigured) {
    try {
      let result;
      if (collection === "users") {
        const profile = Object.fromEntries(
          Object.entries(normalized).filter(([key]) => USER_PROFILE_FIELDS.has(key)),
        );
        result = await supabase.from("users").update(toDatabaseRow(profile)).eq("id", uid);
      } else if (collection === "workouts") {
        result = await supabase.rpc("create_workout", {
          p_id: normalized.id,
          p_name: normalized.name,
          p_type: normalized.type || "strength",
          p_muscle: normalized.muscle || null,
          p_sets: Number(normalized.sets || 0),
          p_reps: Number(normalized.reps || 0),
          p_kcal: Number(normalized.kcal || 0),
          p_duration: Number(normalized.duration || 0),
          p_level: normalized.level || null,
          p_tag: normalized.tag || null,
        });
      } else if (collection === "posts") {
        result = await supabase.from("posts").insert({
          id: normalized.id,
          user_id: uid,
          content: String(normalized.content || "").trim(),
        });
      } else {
        const rowForDatabase = { ...normalized, user_id: normalized.user_id || uid };
        if (collection === "settings") delete rowForDatabase.id;
        result = await supabase
          .from(TABLE_BY_COLLECTION[collection])
          .upsert(toDatabaseRow(rowForDatabase), { onConflict: conflict });
      }
      const { error } = result;
      if (error) throw error;
    } catch (error) {
      console.warn(`FITAI ${collection} remote save failed; kept local copy.`, error.message);
    }
  }
  return normalized;
}

async function removeRow(collection, uid, id) {
  const cache = await readCache(uid);
  cache[collection] = (cache[collection] || []).filter((row) => row.id !== id);
  await writeCache(uid, cache);
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from(TABLE_BY_COLLECTION[collection]).delete().eq("id", id).eq("user_id", uid);
      if (error) throw error;
    } catch (error) {
      console.warn(`FITAI ${collection} remote delete failed.`, error.message);
    }
  }
}

function newId() {
  return Crypto.randomUUID();
}

function withOwnership(uid, payload) {
  const createdAt = payload.created_at || payload.createdAt || nowIso();
  return normalizeRow({ id: payload.id || newId(), ...payload, user_id: uid, created_at: createdAt });
}

export async function ensureUserRecord(user, extra = {}) {
  const uid = uidOf(user);
  if (!uid) return null;
  const current = await getUser(uid);
  return saveRow("users", uid, {
    ...current,
    ...extra,
    id: uid,
    email: extra.email || user?.email || current?.email || "",
    name: extra.name || user?.user_metadata?.name || user?.name || current?.name || "FITAI Member",
    updated_at: nowIso(),
  });
}

export async function getUser(uid) {
  const id = uidOf(uid);
  const rows = await loadRows("users", id);
  if (rows.length) return rows[0];
  const current = await getCurrentUser().catch(() => null);
  return {
    id,
    user_id: id,
    name: current?.user_metadata?.name || current?.name || current?.email?.split("@")[0] || "FITAI Member",
    email: current?.email || "",
    age: current?.user_metadata?.age || current?.age || null,
    gender: current?.user_metadata?.gender || current?.gender || null,
    weight: null,
    height: null,
    streak: 0,
    score: 0,
  };
}

export async function updateUser(uid, updates) {
  const user = await getUser(uid);
  const safeUpdates = isSupabaseConfigured
    ? Object.fromEntries(
        Object.entries(updates || {}).filter(([key]) => USER_PROFILE_FIELDS.has(key)),
      )
    : updates || {};
  return saveRow("users", uidOf(uid), { ...user, ...safeUpdates, id: uidOf(uid), updated_at: nowIso() });
}

export async function getWorkouts(uid) {
  return loadRows("workouts", uidOf(uid));
}

export async function getRecentWorkouts(uid, limit = 5) {
  return (await getWorkouts(uid)).slice(0, limit);
}

export async function addWorkout(uid, payload) {
  const workout = await saveRow("workouts", uidOf(uid), withOwnership(uidOf(uid), payload));
  if (!isSupabaseConfigured) {
    const user = await getUser(uid);
    await updateUser(uid, { workouts: (user.workouts || 0) + 1, score: (user.score || 0) + 10 });
  }
  return workout;
}

export async function getGoals(uid) {
  return loadRows("goals", uidOf(uid));
}

export async function addGoal(uid, payload) {
  return saveRow("goals", uidOf(uid), withOwnership(uidOf(uid), { completed: false, ...payload }));
}

export async function updateGoal(uid, id, updates) {
  const rows = await getGoals(uid);
  const existing = rows.find((row) => row.id === id);
  if (!existing) return null;
  return saveRow("goals", uidOf(uid), { ...existing, ...updates, id, user_id: uidOf(uid), updated_at: nowIso() });
}

export async function getTodayMeals(uid) {
  const today = new Date().toDateString();
  return (await loadRows("meals", uidOf(uid))).filter((meal) => new Date(meal.created_at || meal.createdAt || today).toDateString() === today);
}

export async function addMeal(uid, payload) {
  return saveRow("meals", uidOf(uid), withOwnership(uidOf(uid), payload));
}

export async function deleteMeal(uid, id) {
  return removeRow("meals", uidOf(uid), id);
}

export async function getProgressEntries(uid) {
  return loadRows("progress", uidOf(uid));
}

export async function addProgressEntry(uid, payload) {
  return saveRow("progress", uidOf(uid), withOwnership(uidOf(uid), payload));
}

export async function getSleepLogs(uid) {
  return loadRows("sleep", uidOf(uid));
}

export async function addSleepLog(uid, payload) {
  return saveRow("sleep", uidOf(uid), withOwnership(uidOf(uid), payload));
}

export async function getNotifications(uid) {
  return loadRows("notifications", uidOf(uid));
}

export async function markNotificationRead(uid, id) {
  const rows = await getNotifications(uid);
  const item = rows.find((row) => row.id === id);
  if (!item) return null;
  return saveRow("notifications", uidOf(uid), { ...item, read: true, id, user_id: uidOf(uid) });
}

export async function markAllNotificationsRead(uid) {
  const rows = await getNotifications(uid);
  await Promise.all(rows.filter((row) => !row.read).map((row) => markNotificationRead(uid, row.id)));
}

export async function getSettings(uid) {
  const rows = await loadRows("settings", uidOf(uid));
  return rows[0]?.settings || rows[0] || {};
}

export async function saveSettings(uid, settings) {
  return saveRow("settings", uidOf(uid), { id: uidOf(uid), user_id: uidOf(uid), settings, updated_at: nowIso() }, "user_id");
}

export async function getChallenges() {
  if (!isSupabaseConfigured) return demoChallenges.map(normalizeRow);
  try {
    const { data, error } = await supabase.from("challenges").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data?.length ? data.map(normalizeRow) : demoChallenges.map(normalizeRow);
  } catch (error) {
    console.warn("FITAI challenges remote read failed; using demo list.", error.message);
    return demoChallenges.map(normalizeRow);
  }
}

export async function getJoinedChallenges(uid) {
  return (await loadRows("challenge_members", uidOf(uid)))
    .filter((membership) => membership.user_id === uidOf(uid))
    .map((membership) => membership.challenge_id);
}

export async function joinChallenge(uid, challengeId) {
  const userId = uidOf(uid);
  const cache = await readCache(userId);
  const members = cache.challenge_members || [];
  const existing = members.find((item) => item.challenge_id === challengeId && item.user_id === userId);
  if (existing) return existing;
  const membership = withOwnership(userId, { challenge_id: challengeId, user_id: userId });
  await saveRow("challenge_members", userId, membership, "user_id,challenge_id");
  return membership;
}

export async function leaveChallenge(uid, challengeId) {
  const userId = uidOf(uid);
  const cache = await readCache(userId);
  cache.challenge_members = (cache.challenge_members || []).filter((item) => item.challenge_id !== challengeId);
  await writeCache(userId, cache);
  if (isSupabaseConfigured) {
    try { await supabase.from("challenge_members").delete().eq("user_id", userId).eq("challenge_id", challengeId); }
    catch (error) { console.warn("FITAI challenge leave remote delete failed.", error.message); }
  }
}

export async function addPost(uid, content, userName, userInitials) {
  const post = withOwnership(uidOf(uid), {
    content,
    user_name: userName,
    user_initials: userInitials,
    avatar_color: "#FF6B1A",
    likes: [],
    comments: 0,
  });
  const userId = uidOf(uid);
  if (!isSupabaseConfigured) {
    const cache = await readCache("public");
    cache.posts = [post, ...(cache.posts || []).filter((item) => item.id !== post.id)];
    await writeCache("public", cache);
  }
  await saveRow("posts", userId, post);
  for (const listener of postListeners) listener(await getPosts(uid));
  return post;
}

async function getPosts(uid) {
  const currentUid = uidOf(uid);
  if (isSupabaseConfigured && currentUid) {
    const posts = await loadRows("posts", currentUid);
    if (!posts.length) return posts;
    try {
      const { data, error } = await supabase
        .from("post_likes")
        .select("post_id,user_id")
        .in("post_id", posts.map((post) => post.id));
      if (error) throw error;
      const likesByPost = new Map();
      for (const like of data || []) {
        const likes = likesByPost.get(like.post_id) || [];
        likes.push(like.user_id);
        likesByPost.set(like.post_id, likes);
      }
      return posts.map((post) => ({ ...post, likes: likesByPost.get(post.id) || [] }));
    } catch (error) {
      console.warn("FITAI post likes read failed.", error.message);
      return posts;
    }
  }
  const cache = await readCache("public");
  return (cache.posts || []).map(normalizeRow);
}

export function subscribeToPosts(callback) {
  postListeners.add(callback);
  let channel;
  if (isSupabaseConfigured) {
    channel = supabase
      .channel("fitai-community-posts")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, async () => {
        const user = await getCurrentUser();
        callback(await getPosts(user?.id || user?.uid));
      })
      .subscribe();
  }
  getCurrentUser()
    .then((user) => getPosts(user?.id || user?.uid))
    .then(callback)
    .catch(() => callback([]));
  return () => {
    postListeners.delete(callback);
    if (channel) supabase.removeChannel(channel);
  };
}

export async function toggleLike(postId, uid) {
  const userId = uidOf(uid);
  if (isSupabaseConfigured) {
    const { error } = await supabase.rpc("toggle_post_like", { p_post_id: postId });
    if (error) throw error;
    const posts = await getPosts(userId);
    for (const listener of postListeners) listener(posts);
    return posts.find((post) => post.id === postId) || null;
  }

  const cache = await readCache("public");
  const rows = cache.posts || [];
  const target = rows.find((row) => row.id === postId);
  if (!target) return null;
  const likes = Array.isArray(target.likes) ? target.likes : [];
  const nextLikes = likes.includes(userId) ? likes.filter((id) => id !== userId) : [...likes, userId];
  const saved = { ...target, likes: nextLikes, id: postId, user_id: userId };
  cache.posts = rows.map((row) => row.id === postId ? saved : row);
  await writeCache("public", cache);
  await saveRow("posts", userId, saved);
  for (const listener of postListeners) listener(await getPosts(userId));
  return saved;
}

export async function getLeaderboard() {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.rpc("get_leaderboard");
      if (error) throw error;
      if (data?.length) return data.map(normalizeRow);
    } catch (error) {
      console.warn("FITAI leaderboard remote read failed; using sample data.", error.message);
    }
  }
  return [
    { id: "sample-1", name: "FitAI Runner", score: 420, streak: 12 },
    { id: "sample-2", name: "Active Member", score: 360, streak: 9 },
    { id: "sample-3", name: "Daily Mover", score: 300, streak: 7 },
  ];
}
