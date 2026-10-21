import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../firebase/config";
import { signOut } from "../firebase/auth";
import { getSettings, saveSettings } from "../firebase/db";

const SettingsScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [uid, setUid] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    auth.getCurrentUser().then((user) => setUid(user?.uid || user?.id || null));
  }, []);

  useEffect(() => {
    if (!uid) return;
    loadSettings(uid);
  }, [uid]);

  const loadSettings = async (nextUid = uid) => {
    if (!nextUid) return;
    setLoading(true);
    try {
      const data = await getSettings(nextUid);
      setSettings(data);
    } catch (error) {
      Alert.alert("เกิดข้อผิดพลาด", error.message);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  const handleSave = async () => {
    if (!uid || !settings) return;
    setLoading(true);
    try {
      const saved = await saveSettings(uid, settings);
      setSettings(saved);
      Alert.alert("สำเร็จ", "บันทึกการตั้งค่าแล้ว");
    } catch (error) {
      Alert.alert("เกิดข้อผิดพลาด", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchAccount = () => {
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

  const toggleSetting = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const sections = [
    {
      title: "การแจ้งเตือน",
      items: [
        { key: "pushNotifications", label: "แจ้งเตือนทั่วไป", icon: "🔔" },
        { key: "workoutReminder", label: "เตือนเวลาออกกำลังกาย", icon: "⏰" },
      ],
    },
    {
      title: "การแสดงผล",
      items: [
        { key: "darkMode", label: "โหมดมืด", icon: "🌙" },
        { key: "soundEffects", label: "เสียงประกอบ", icon: "🔊" },
        { key: "metricUnits", label: "ใช้หน่วยกิโลกรัม/กิโลเมตร", icon: "📏" },
      ],
    },
    {
      title: "ความเป็นส่วนตัว",
      items: [
        { key: "shareProgress", label: "แชร์ความคืบหน้าในชุมชน", icon: "📢" },
      ],
    },
    {
      title: "อุปกรณ์และ AI",
      items: [
        { key: "heartRateMonitor", label: "เชื่อมต่อ Heart Rate Monitor", icon: "❤️" },
        { key: "autoDetect", label: "เปิดตรวจจับอัตโนมัติ", icon: "📷" },
      ],
    },
  ];

  if (!initialLoadDone || !settings) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color="#FF6B1A" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>กลับ</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>การตั้งค่า</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#FF6B1A" size="small" />
          ) : (
            <Text style={styles.saveBtn}>บันทึก</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, index) => (
                <View
                  key={item.key}
                  style={[
                    styles.settingRow,
                    index < section.items.length - 1 && styles.settingRowBorder,
                  ]}
                >
                  <Text style={styles.settingIcon}>{item.icon}</Text>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  <Switch
                    value={!!settings[item.key]}
                    onValueChange={() => toggleSetting(item.key)}
                    trackColor={{ false: "#2a2a2a", true: "rgba(255,107,26,0.4)" }}
                    thumbColor={settings[item.key] ? "#FF6B1A" : "#555"}
                  />
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>บัญชี</Text>
          <View style={styles.sectionCard}>
            <View style={[styles.actionRow, styles.settingRowBorder]}>
              <Text style={styles.settingIcon}>🌐</Text>
              <Text style={styles.settingLabel}>ภาษา</Text>
              <Text style={styles.actionValue}>ไทย</Text>
            </View>
            <TouchableOpacity style={styles.actionRow} onPress={handleSwitchAccount}>
              <Text style={styles.settingIcon}>🚪</Text>
              <Text style={[styles.settingLabel, styles.dangerText]}>
                ออกจากระบบและกลับหน้าล็อกอิน
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.version}>FITAI v1.0.0</Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: { fontSize: 16, color: "#FF6B1A", fontWeight: "600" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#f0ece6" },
  saveBtn: { fontSize: 14, color: "#FF6B1A", fontWeight: "600" },
  section: { paddingHorizontal: 16, marginBottom: 10 },
  sectionTitle: { fontSize: 12, color: "#888", marginBottom: 8, marginLeft: 4 },
  sectionCard: { backgroundColor: "#1a1a1a", borderRadius: 14, overflow: "hidden" },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  settingRowBorder: { borderBottomWidth: 1, borderBottomColor: "#2a2a2a" },
  settingIcon: { fontSize: 18, width: 28 },
  settingLabel: { flex: 1, fontSize: 14, color: "#f0ece6" },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  actionValue: { fontSize: 13, color: "#999" },
  dangerText: { color: "#f87171" },
  version: { textAlign: "center", color: "#444", fontSize: 12, marginTop: 16 },
});

export default SettingsScreen;
