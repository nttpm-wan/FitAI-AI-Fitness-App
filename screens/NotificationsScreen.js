import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../firebase/config";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../firebase/db";

const TYPE_COLORS = {
  workout: "#FF6B1A",
  achievement: "#facc15",
  social: "#60a5fa",
  challenge: "#a78bfa",
  nutrition: "#4ade80",
};

const NotificationsScreen = ({ navigation }) => {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const bootstrap = async () => {
      const currentUser = await auth.getCurrentUser();
      const nextUid = currentUser?.uid || currentUser?.id || null;
      setUid(nextUid);
      await loadNotifications(nextUid);
    };
    bootstrap();
  }, []);

  const loadNotifications = async (currentUid = uid) => {
    setLoading(true);
    try {
      const data = await getNotifications(currentUid);
      setNotifications(data);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const handleMarkRead = async (item) => {
    if (!uid || item.read) return;
    await markNotificationRead(uid, item.id);
    setNotifications((prev) => prev.map((notif) => (notif.id === item.id ? { ...notif, read: true } : notif)));
  };

  const handleMarkAllRead = async () => {
    if (!uid || unreadCount === 0) return;
    setLoading(true);
    await markAllNotificationsRead(uid);
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    setLoading(false);
  };

  const formatTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, item.read && styles.cardRead]}
      onPress={() => handleMarkRead(item)}
    >
      <View style={[styles.iconBox, { backgroundColor: `${TYPE_COLORS[item.type] || "#666"}20` }]}>
        <Text style={styles.iconText}>{item.icon || "N"}</Text>
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, item.read && styles.titleRead]}>{item.title}</Text>
        <Text style={styles.text}>{item.body}</Text>
        <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
      </View>
      {!item.read ? <View style={styles.dot} /> : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          ) : null}
        </View>
        <TouchableOpacity onPress={handleMarkAllRead} disabled={loading || unreadCount === 0}>
          <Text style={[styles.markAll, unreadCount === 0 && styles.markAllDisabled]}>Mark all</Text>
        </TouchableOpacity>
      </View>

      {!initialLoadDone ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color="#FF6B1A" size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No notifications.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButton: { color: "#FF6B1A", fontSize: 16, fontWeight: "600" },
  headerCenter: { flexDirection: "row", alignItems: "center" },
  headerTitle: { color: "#f0ece6", fontSize: 18, fontWeight: "700" },
  badge: { backgroundColor: "#FF6B1A", borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginLeft: 8 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  markAll: { color: "#FF6B1A", fontSize: 12 },
  markAllDisabled: { opacity: 0.35 },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { flexDirection: "row", backgroundColor: "#1a1a1a", borderRadius: 14, padding: 14, alignItems: "flex-start" },
  cardRead: { opacity: 0.6 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconText: { fontSize: 20, color: "#fff" },
  body: { flex: 1 },
  title: { color: "#f0ece6", fontSize: 14, fontWeight: "700", marginBottom: 4 },
  titleRead: { fontWeight: "400" },
  text: { color: "#888", fontSize: 12, lineHeight: 18, marginBottom: 4 },
  time: { color: "#555", fontSize: 11 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF6B1A", marginTop: 4 },
  emptyBox: { alignItems: "center", paddingVertical: 60 },
  emptyText: { color: "#666", fontSize: 14 },
});

export default NotificationsScreen;
