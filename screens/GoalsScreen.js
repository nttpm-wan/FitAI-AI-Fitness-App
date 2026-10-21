import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../firebase/config";
import { addGoal, getGoals, updateGoal } from "../firebase/db";

const GoalsScreen = ({ navigation }) => {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [goals, setGoals] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "",
    target: "",
    unit: "",
    current: "0",
    color: "#FF6B1A",
    icon: "🎯",
  });

  useEffect(() => {
    auth.getCurrentUser().then((user) => setUid(user?.uid || user?.id || null));
  }, []);

  useEffect(() => {
    if (!uid) return;
    loadGoals(uid);
  }, [uid]);

  const loadGoals = async (nextUid = uid) => {
    if (!nextUid) return;
    setLoading(true);
    try {
      const data = await getGoals(nextUid);
      setGoals(data);
    } catch (error) {
      Alert.alert("เกิดข้อผิดพลาด", error.message);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  const handleToggleComplete = async (goal) => {
    try {
      await updateGoal(uid, goal.id, { completed: !goal.completed });
      setGoals((prev) =>
        prev.map((item) =>
          item.id === goal.id ? { ...item, completed: !goal.completed } : item
        )
      );
    } catch (error) {
      Alert.alert("เกิดข้อผิดพลาด", error.message);
    }
  };

  const handleAddGoal = async () => {
    if (!uid) {
      Alert.alert("ยังไม่พบบัญชีผู้ใช้");
      return;
    }

    if (!form.title.trim() || !form.target) {
      Alert.alert("กรุณากรอกชื่อเป้าหมายและค่าเป้าหมาย");
      return;
    }

    setLoading(true);
    try {
      await addGoal(uid, {
        title: form.title.trim(),
        category: form.category.trim() || "ทั่วไป",
        target: parseFloat(form.target) || 0,
        current: parseFloat(form.current) || 0,
        unit: form.unit.trim() || "",
        color: form.color,
        icon: form.icon,
        deadline: "ไม่กำหนด",
        completed: false,
      });
      setForm({
        title: "",
        category: "",
        target: "",
        unit: "",
        current: "0",
        color: "#FF6B1A",
        icon: "🎯",
      });
      setModalVisible(false);
      await loadGoals(uid);
    } catch (error) {
      Alert.alert("เกิดข้อผิดพลาด", error.message);
    } finally {
      setLoading(false);
    }
  };

  const completed = useMemo(
    () => goals.filter((goal) => goal.completed).length,
    [goals]
  );

  if (!initialLoadDone) {
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
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backBtn}>กลับ</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>เป้าหมาย</Text>
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <Text style={styles.addBtn}>+ เพิ่ม</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{goals.length}</Text>
            <Text style={styles.summaryLabel}>เป้าหมายทั้งหมด</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{completed}</Text>
            <Text style={styles.summaryLabel}>ทำสำเร็จแล้ว</Text>
          </View>
        </View>

        <View style={styles.list}>
          {goals.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>ยังไม่มีเป้าหมาย</Text>
              <Text style={styles.emptyText}>กดปุ่ม + เพิ่ม เพื่อเริ่มตั้งเป้าหมายแรกของคุณ</Text>
            </View>
          ) : (
            goals.map((goal) => {
              const progress = goal.completed
                ? 1
                : goal.target > 0
                ? Math.min((goal.current || 0) / goal.target, 1)
                : 0;
              return (
                <View key={goal.id} style={[styles.goalCard, goal.completed && styles.goalCardDone]}>
                  <View style={styles.goalTop}>
                    <View style={[styles.goalIcon, { backgroundColor: `${goal.color || "#FF6B1A"}20` }]}>
                      <Text style={styles.goalIconText}>{goal.icon || "🎯"}</Text>
                    </View>
                    <View style={styles.goalInfo}>
                      <Text style={styles.goalCategory}>{goal.category}</Text>
                      <Text style={[styles.goalTitle, goal.completed && styles.goalTitleDone]}>
                        {goal.title}
                      </Text>
                      <Text style={styles.goalMeta}>
                        {goal.current || 0} / {goal.target} {goal.unit || ""}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.checkBtn} onPress={() => handleToggleComplete(goal)}>
                      <Text style={styles.checkText}>{goal.completed ? "✓" : "○"}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.goalBarBg}>
                    <View
                      style={[
                        styles.goalBarFill,
                        {
                          width: `${Math.round(progress * 100)}%`,
                          backgroundColor: goal.color || "#FF6B1A",
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>เพิ่มเป้าหมายใหม่</Text>
            {[
              { key: "title", label: "ชื่อเป้าหมาย *", placeholder: "เช่น วิ่ง 5 กม." },
              { key: "category", label: "หมวดหมู่", placeholder: "เช่น การวิ่ง" },
              { key: "current", label: "ค่าปัจจุบัน", placeholder: "0" },
              { key: "target", label: "ค่าเป้าหมาย *", placeholder: "เช่น 5" },
              { key: "unit", label: "หน่วย", placeholder: "เช่น กม., กก." },
            ].map(({ key, label, placeholder }) => (
              <View key={key}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={placeholder}
                  placeholderTextColor="#666"
                  keyboardType={key === "title" || key === "category" || key === "unit" ? "default" : "decimal-pad"}
                  inputMode={key === "title" || key === "category" || key === "unit" ? "text" : "decimal"}
                  value={form[key]}
                  onChangeText={(value) => setForm({ ...form, [key]: value })}
                />
              </View>
            ))}

            <TouchableOpacity style={styles.btnSave} onPress={handleAddGoal} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSaveText}>บันทึก</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setModalVisible(false)}>
              <Text style={styles.btnCancelText}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { fontSize: 16, color: "#FF6B1A", fontWeight: "600" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#f0ece6" },
  addBtn: { fontSize: 14, color: "#FF6B1A", fontWeight: "600" },
  summaryCard: { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, backgroundColor: "#1a1a1a", borderRadius: 16, padding: 20 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryDivider: { width: 1, backgroundColor: "#2a2a2a" },
  summaryValue: { fontSize: 24, fontWeight: "700", color: "#f0ece6" },
  summaryLabel: { fontSize: 12, color: "#888", marginTop: 4 },
  list: { paddingHorizontal: 16, gap: 10, paddingBottom: 24 },
  goalCard: { backgroundColor: "#1a1a1a", borderRadius: 14, padding: 16 },
  goalCardDone: { opacity: 0.7 },
  goalTop: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  goalIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 12 },
  goalIconText: { fontSize: 22 },
  goalInfo: { flex: 1 },
  goalCategory: { fontSize: 11, color: "#888", marginBottom: 4 },
  goalTitle: { fontSize: 15, fontWeight: "700", color: "#f0ece6" },
  goalTitleDone: { textDecorationLine: "line-through", color: "#999" },
  goalMeta: { fontSize: 12, color: "#888", marginTop: 4 },
  checkBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  checkText: { fontSize: 22, color: "#FF6B1A" },
  goalBarBg: { height: 8, backgroundColor: "#1e1e1e", borderRadius: 999, overflow: "hidden" },
  goalBarFill: { height: "100%", borderRadius: 999 },
  emptyBox: { backgroundColor: "#1a1a1a", borderRadius: 16, padding: 24, alignItems: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#f0ece6" },
  emptyText: { fontSize: 13, color: "#888", textAlign: "center", marginTop: 8, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#1a1a1a", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#f0ece6", marginBottom: 8 },
  fieldLabel: { fontSize: 11, color: "#888", marginBottom: 6, marginTop: 12 },
  modalInput: { backgroundColor: "#1e1e1e", borderWidth: 1, borderColor: "#2a2a2a", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: "#f0ece6", fontSize: 14 },
  btnSave: { backgroundColor: "#FF6B1A", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  btnSaveText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  btnCancel: { paddingVertical: 12, alignItems: "center", marginTop: 8 },
  btnCancelText: { color: "#888", fontSize: 14 },
});

export default GoalsScreen;
