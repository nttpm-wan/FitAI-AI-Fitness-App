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
import Svg, { Circle, Defs, LinearGradient, Polygon, Polyline, Stop } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../firebase/config";
import { addProgressEntry, getProgressEntries, getUser, updateUser } from "../firebase/db";

const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  const normalized = String(value).replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getBmiStatus = (bmi) => {
  if (!bmi) return "-";
  if (bmi < 18.5) return "น้ำหนักน้อย";
  if (bmi < 25) return "ปกติ";
  if (bmi < 30) return "น้ำหนักเกิน";
  return "อ้วน";
};

const ProgressScreen = () => {
  const [entries, setEntries] = useState([]);
  const [profile, setProfile] = useState(null);
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ weight: "", height: "" });

  useEffect(() => {
    auth.getCurrentUser().then((user) => setUid(user?.uid || user?.id || null));
  }, []);

  useEffect(() => {
    if (!uid) return;
    loadData(uid);
  }, [uid]);

  const loadData = async (nextUid = uid) => {
    if (!nextUid) return;

    setLoading(true);
    try {
      const [user, data] = await Promise.all([getUser(nextUid), getProgressEntries(nextUid)]);
      setProfile(user);
      setEntries(data);
    } catch (error) {
      Alert.alert("เกิดข้อผิดพลาด", error.message || "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  const handleSave = async () => {
    if (!uid) {
      Alert.alert("ยังไม่พบบัญชีผู้ใช้");
      return;
    }

    const weight = toNumber(form.weight);
    const height = toNumber(form.height);

    if (weight <= 0 || height <= 0) {
      Alert.alert("กรุณากรอกน้ำหนักและส่วนสูงให้ถูกต้อง");
      return;
    }

    setLoading(true);
    try {
      const bmi = weight / ((height / 100) * (height / 100));
      await addProgressEntry(uid, { weight, bmi });
      await updateUser(uid, { weight, height });

      setForm({ weight: "", height: "" });
      setModalVisible(false);
      await loadData(uid);

      Alert.alert("บันทึกสำเร็จ", `BMI ล่าสุด: ${bmi.toFixed(1)}`);
    } catch (error) {
      Alert.alert("เกิดข้อผิดพลาด", error.message || "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const weights = useMemo(
    () => entries.map((entry) => Number(entry.weight)).filter((value) => Number.isFinite(value) && value > 0),
    [entries]
  );

  const latestEntry = entries[entries.length - 1] || {};
  const currentWeight = weights[weights.length - 1] || toNumber(profile?.weight);
  const currentHeight = toNumber(profile?.height);

  const bmiFromEntry = toNumber(latestEntry?.bmi);
  const bmiFromFormula =
    currentWeight > 0 && currentHeight > 0
      ? currentWeight / ((currentHeight / 100) * (currentHeight / 100))
      : 0;
  const currentBmi = bmiFromEntry || bmiFromFormula;

  const WeightChart = ({ data }) => {
    if (data.length < 2) return null;

    const width = 300;
    const height = 100;
    const padding = 10;
    const min = Math.min(...data) - 1;
    const max = Math.max(...data) + 1;

    const points = data.map((val, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((val - min) / Math.max(max - min, 1)) * (height - padding * 2);
      return `${x},${y}`;
    });

    const lastPoint = points[points.length - 1].split(",");
    const polygonPoints = `${points.join(" ")} ${lastPoint[0]},${height} ${padding},${height}`;

    return (
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="progress-gradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FF6B1A" stopOpacity="0.35" />
            <Stop offset="100%" stopColor="#FF6B1A" stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Polygon points={polygonPoints} fill="url(#progress-gradient)" />
        <Polyline points={points.join(" ")} fill="none" stroke="#FF6B1A" strokeWidth="2" />
        <Circle cx={lastPoint[0]} cy={lastPoint[1]} r="4" fill="#FF6B1A" />
      </Svg>
    );
  };

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
          <Text style={styles.headerTitle}>ติดตามความคืบหน้า</Text>
          <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.logBtn}>
            <Text style={styles.logBtnText}>+ บันทึก</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.weightSection}>
          <Text style={styles.weightLabel}>น้ำหนักปัจจุบัน</Text>
          <View style={styles.weightRow}>
            <Text style={styles.weightBig}>{currentWeight ? currentWeight.toFixed(1) : "0.0"}</Text>
            <Text style={styles.weightUnit}> กก.</Text>
          </View>
        </View>

        {weights.length >= 2 ? (
          <View style={styles.chartCard}>
            <WeightChart data={weights} />
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>สถิติร่างกาย</Text>
        </View>

        <View style={styles.bodyStats}>
          <View style={styles.bodyStat}>
            <Text style={styles.bodyStatVal}>{currentWeight ? `${currentWeight.toFixed(1)}` : "-"}</Text>
            <Text style={styles.bodyStatLbl}>น้ำหนัก (กก.)</Text>
          </View>

          <View style={styles.bodyStat}>
            <Text style={styles.bodyStatVal}>{currentHeight ? `${currentHeight.toFixed(0)}` : "-"}</Text>
            <Text style={styles.bodyStatLbl}>ส่วนสูง (ซม.)</Text>
          </View>

          <View style={styles.bodyStat}>
            <Text style={styles.bodyStatVal}>{currentBmi ? currentBmi.toFixed(1) : "-"}</Text>
            <Text style={styles.bodyStatLbl}>BMI</Text>
          </View>
        </View>

        <View style={styles.bmiStatusBox}>
          <Text style={styles.bmiStatusLabel}>สถานะ BMI</Text>
          <Text style={styles.bmiStatusValue}>{getBmiStatus(currentBmi)}</Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>บันทึกน้ำหนักและส่วนสูง</Text>

            <Text style={styles.fieldLabel}>น้ำหนัก (กก.) *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="เช่น 72.5"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
              inputMode="decimal"
              value={form.weight}
              onChangeText={(value) => setForm((prev) => ({ ...prev, weight: value }))}
            />

            <Text style={styles.fieldLabel}>ส่วนสูง (ซม.) *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="เช่น 175"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
              inputMode="decimal"
              value={form.height}
              onChangeText={(value) => setForm((prev) => ({ ...prev, height: value }))}
            />

            <TouchableOpacity style={styles.btnSave} onPress={handleSave} disabled={loading}>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#f0ece6" },
  logBtn: { backgroundColor: "#FF6B1A", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  logBtnText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  weightSection: { paddingHorizontal: 20, paddingBottom: 8 },
  weightLabel: { fontSize: 12, color: "#888", marginBottom: 4 },
  weightRow: { flexDirection: "row", alignItems: "baseline" },
  weightBig: { fontSize: 52, fontWeight: "800", color: "#f0ece6" },
  weightUnit: { fontSize: 22, color: "#888" },
  chartCard: {
    marginHorizontal: 16,
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 16,
    height: 120,
    justifyContent: "flex-end",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#f0ece6" },
  bodyStats: { flexDirection: "row", gap: 10, paddingHorizontal: 16 },
  bodyStat: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
  },
  bodyStatVal: { fontSize: 20, fontWeight: "700", color: "#f0ece6" },
  bodyStatLbl: { fontSize: 11, color: "#888", marginTop: 4 },
  bmiStatusBox: {
    marginTop: 12,
    marginHorizontal: 16,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bmiStatusLabel: { color: "#888", fontSize: 12 },
  bmiStatusValue: { color: "#FF6B1A", fontSize: 14, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#f0ece6", marginBottom: 8 },
  fieldLabel: { fontSize: 11, color: "#888", marginBottom: 6, marginTop: 12 },
  modalInput: {
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#f0ece6",
    fontSize: 14,
  },
  btnSave: {
    backgroundColor: "#FF6B1A",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 16,
  },
  btnSaveText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  btnCancel: { paddingVertical: 12, alignItems: "center", marginTop: 8 },
  btnCancelText: { color: "#888", fontSize: 14 },
});

export default ProgressScreen;
