import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../firebase/config";
import { signOut } from "../firebase/auth";
import { getUser } from "../firebase/db";

const ProfileScreen = ({ navigation }) => {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [profile, setProfile] = useState(null);
  const [account, setAccount] = useState(null);

  useEffect(() => {
    auth.getCurrentUser().then((user) => {
      setAccount(user);
      setUid(user?.uid || user?.id || null);
    });
  }, []);

  useEffect(() => {
    if (!uid) return;
    loadProfile(uid);
  }, [uid]);

  const loadProfile = async (nextUid = uid) => {
    if (!nextUid) return;
    setLoading(true);
    try {
      const user = await getUser(nextUid);
      setProfile(user);
    } catch (error) {
      Alert.alert("เกิดข้อผิดพลาด", error.message);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  const handleLogout = () => {
    Alert.alert("ออกจากระบบ", "ต้องการกลับไปหน้าล็อกอินใช่ไหม?", [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ออกจากระบบ",
        style: "destructive",
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  const menuItems = [
    { icon: "📘", label: "ประวัติการออกกำลังกาย", onPress: () => navigation.navigate("WorkoutHistory") },
    { icon: "🎯", label: "เป้าหมาย", onPress: () => navigation.navigate("Goals") },
    { icon: "🔔", label: "การแจ้งเตือน", onPress: () => navigation.navigate("Notifications") },
    { icon: "😴", label: "ติดตามการนอน", onPress: () => navigation.navigate("SleepTracker") },
    { icon: "🏆", label: "อันดับผู้ใช้งาน", onPress: () => navigation.navigate("Leaderboard") },
    { icon: "🏋️", label: "คลังท่าออกกำลังกาย", onPress: () => navigation.navigate("ExerciseLibrary") },
    { icon: "📷", label: "กล้องเทรนเนอร์", onPress: () => navigation.navigate("CameraAI") },
    { icon: "🚀", label: "ชาเลนจ์", onPress: () => navigation.navigate("Challenges") },
    { icon: "⚙️", label: "การตั้งค่า", onPress: () => navigation.navigate("Settings") },
  ];

  if (!initialLoadDone) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color="#FF6B1A" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const name = profile?.name || account?.user_metadata?.full_name || "นักกีฬา";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.profileTop}>
          <View style={styles.profileHeader}>
            <Text style={styles.screenTitle}>โปรไฟล์</Text>
            <TouchableOpacity onPress={() => loadProfile(uid)} disabled={loading}>
              {loading ? <ActivityIndicator color="#FF6B1A" size="small" /> : <Text style={styles.editBtn}>รีเฟรช</Text>}
            </TouchableOpacity>
          </View>

          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>

          <Text style={styles.profileName}>{name}</Text>
          <Text style={styles.profileHandle}>{account?.email || ""}</Text>

          <View style={styles.statsRow}>
            <View style={styles.pStat}>
              <Text style={styles.pStatVal}>{profile?.workouts || 0}</Text>
              <Text style={styles.pStatLbl}>Workout</Text>
            </View>
            <View style={[styles.pStat, styles.pStatBorder]}>
              <Text style={styles.pStatVal}>{profile?.weight || "-"}</Text>
              <Text style={styles.pStatLbl}>กก.</Text>
            </View>
            <View style={[styles.pStat, styles.pStatBorder]}>
              <Text style={styles.pStatVal}>{profile?.streak || 0}</Text>
              <Text style={styles.pStatLbl}>Streak</Text>
            </View>
          </View>
        </View>

        <View style={styles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, index === menuItems.length - 1 && styles.menuItemLast]}
              onPress={item.onPress}
            >
              <View style={styles.menuIcon}>
                <Text style={styles.menuIconText}>{item.icon}</Text>
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.menuIconText}>🚪</Text>
          <Text style={styles.logoutText}>ออกจากระบบ</Text>
        </TouchableOpacity>

        <Text style={styles.version}>FITAI v1.0.0</Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  profileTop: { backgroundColor: "#1a1a1a", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, marginBottom: 12 },
  profileHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  screenTitle: { fontSize: 20, fontWeight: "700", color: "#f0ece6" },
  editBtn: { fontSize: 14, color: "#FF6B1A", fontWeight: "600" },
  avatarWrap: { alignItems: "center", marginBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#FF6B1A", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 28, fontWeight: "800" },
  profileName: { fontSize: 20, fontWeight: "700", color: "#f0ece6", textAlign: "center" },
  profileHandle: { fontSize: 13, color: "#888", textAlign: "center", marginTop: 4, marginBottom: 20 },
  statsRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#2a2a2a", marginTop: 4 },
  pStat: { flex: 1, alignItems: "center", paddingTop: 16 },
  pStatBorder: { borderLeftWidth: 1, borderLeftColor: "#2a2a2a" },
  pStatVal: { fontSize: 20, fontWeight: "700", color: "#f0ece6" },
  pStatLbl: { fontSize: 11, color: "#888", marginTop: 2 },
  menuSection: { marginHorizontal: 16, backgroundColor: "#1a1a1a", borderRadius: 14, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: "#2a2a2a" },
  menuItemLast: { borderBottomWidth: 0 },
  menuIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#1e1e1e", alignItems: "center", justifyContent: "center" },
  menuIconText: { fontSize: 17 },
  menuLabel: { flex: 1, fontSize: 14, color: "#f0ece6" },
  menuArrow: { fontSize: 20, color: "#444" },
  logoutBtn: { flexDirection: "row", alignItems: "center", gap: 14, marginHorizontal: 16, marginTop: 12, backgroundColor: "#1a1a1a", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  logoutText: { fontSize: 14, color: "#ff4d4d", fontWeight: "500" },
  version: { textAlign: "center", color: "#444", fontSize: 11, marginTop: 20 },
});

export default ProfileScreen;
