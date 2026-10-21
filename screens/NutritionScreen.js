import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Text as SvgText } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../firebase/config";
import { addMeal, deleteMeal, getTodayMeals } from "../firebase/db";

const MEAL_OPTIONS = ["เช้า", "กลางวัน", "เย็น", "ของว่าง"];

const NutritionScreen = () => {
  const [uid, setUid] = useState(null);
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({
    meal: "เช้า",
    food: "",
    kcal: "",
    protein: "",
    carbs: "",
    fat: "",
  });

  useEffect(() => {
    auth.getCurrentUser().then((user) => setUid(user?.uid || user?.id || null));
  }, []);

  useEffect(() => {
    if (!uid) return;
    loadMeals(uid);
  }, [uid]);

  const loadMeals = async (nextUid = uid) => {
    if (!nextUid) return;
    setLoading(true);
    try {
      const data = await getTodayMeals(nextUid);
      setMeals(data);
    } catch (error) {
      Alert.alert("เกิดข้อผิดพลาด", error.message);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  const handleAddMeal = async () => {
    if (!uid) {
      Alert.alert("ยังไม่พบบัญชีผู้ใช้");
      return;
    }

    if (!form.food.trim() || !form.kcal) {
      Alert.alert("กรุณากรอกชื่ออาหารและแคลอรี่");
      return;
    }

    setLoading(true);
    try {
      await addMeal(uid, {
        meal: form.meal,
        food: form.food.trim(),
        kcal: parseInt(form.kcal, 10) || 0,
        protein: parseInt(form.protein, 10) || 0,
        carbs: parseInt(form.carbs, 10) || 0,
        fat: parseInt(form.fat, 10) || 0,
        time: new Date().toLocaleTimeString("th-TH", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      });
      setForm({ meal: "เช้า", food: "", kcal: "", protein: "", carbs: "", fat: "" });
      setModalVisible(false);
      await loadMeals(uid);
    } catch (error) {
      Alert.alert("เกิดข้อผิดพลาด", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id, food) => {
    Alert.alert("ลบรายการอาหาร", `ต้องการลบ "${food}" ใช่ไหม?`, [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ",
        style: "destructive",
        onPress: async () => {
          await deleteMeal(uid, id);
          await loadMeals(uid);
        },
      },
    ]);
  };

  const totalKcal = useMemo(() => meals.reduce((sum, meal) => sum + (meal.kcal || 0), 0), [meals]);
  const totalProtein = useMemo(() => meals.reduce((sum, meal) => sum + (meal.protein || 0), 0), [meals]);
  const totalCarbs = useMemo(() => meals.reduce((sum, meal) => sum + (meal.carbs || 0), 0), [meals]);
  const totalFat = useMemo(() => meals.reduce((sum, meal) => sum + (meal.fat || 0), 0), [meals]);
  const goalCalories = 2100;
  const calProgress = Math.min(totalKcal / goalCalories, 1);
  const remaining = goalCalories - totalKcal;

  const macros = [
    { label: "โปรตีน", current: totalProtein, goal: 120, color: "#FF6B1A" },
    { label: "คาร์บ", current: totalCarbs, goal: 260, color: "#FF8C3A" },
    { label: "ไขมัน", current: totalFat, goal: 65, color: "#FFA040" },
  ];

  const CalorieRing = () => {
    const size = 90;
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - calProgress);
    return (
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e1e1e" strokeWidth={9} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#FF6B1A"
          strokeWidth={9}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <SvgText x={size / 2} y={size / 2 - 5} textAnchor="middle" fill="#f0ece6" fontSize="13" fontWeight="700">
          {Math.round(calProgress * 100)}%
        </SvgText>
        <SvgText x={size / 2} y={size / 2 + 10} textAnchor="middle" fill="#888" fontSize="9">
          เป้าหมาย
        </SvgText>
      </Svg>
    );
  };

  const renderMeal = ({ item }) => (
    <TouchableOpacity style={styles.mealCard} onLongPress={() => handleDelete(item.id, item.food)}>
      <View>
        <Text style={styles.mealName}>{item.meal}</Text>
        <Text style={styles.mealFood}>
          {item.food} • {item.time}
        </Text>
        <Text style={styles.mealMacro}>
          P:{item.protein}g C:{item.carbs}g F:{item.fat}g
        </Text>
      </View>
      <Text style={styles.mealKcal}>{item.kcal} kcal</Text>
    </TouchableOpacity>
  );

  if (!initialLoadDone) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#FF6B1A" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>โภชนาการวันนี้</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>วันนี้</Text>
          </View>
        </View>

        <View style={styles.caloriesCard}>
          <CalorieRing />
          <View style={styles.calInfo}>
            <Text style={styles.calLeft}>
              {totalKcal.toLocaleString()} <Text style={styles.calUnit}>kcal</Text>
            </Text>
            <Text style={styles.calSub}>เป้าหมาย {goalCalories.toLocaleString()} kcal</Text>
            <Text style={[styles.calRemaining, remaining < 0 && { color: "#f87171" }]}>
              {remaining >= 0 ? `เหลือ ${remaining}` : `เกิน ${Math.abs(remaining)}`} kcal
            </Text>
          </View>
        </View>

        <View style={styles.macroCard}>
          {macros.map((macro) => (
            <View key={macro.label} style={styles.macroRow}>
              <Text style={styles.macroLabel}>{macro.label}</Text>
              <View style={styles.macroBarBg}>
                <View
                  style={[
                    styles.macroBarFill,
                    {
                      width: `${Math.min((macro.current / macro.goal) * 100, 100)}%`,
                      backgroundColor: macro.color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.macroG}>{macro.current}g</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>มื้ออาหารวันนี้</Text>
          <TouchableOpacity onPress={() => setModalVisible(true)}>
            <Text style={styles.sectionLink}>+ เพิ่ม</Text>
          </TouchableOpacity>
        </View>

        {meals.length === 0 ? (
          <TouchableOpacity style={styles.addMealBtn} onPress={() => setModalVisible(true)}>
            <Text style={styles.addMealText}>+ บันทึกมื้ออาหารแรกของวัน</Text>
          </TouchableOpacity>
        ) : (
          <>
            <FlatList
              data={meals}
              keyExtractor={(item) => item.id}
              renderItem={renderMeal}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
            <TouchableOpacity style={styles.addMealBtn} onPress={() => setModalVisible(true)}>
              <Text style={styles.addMealText}>+ เพิ่มมื้ออาหาร</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>เพิ่มมื้ออาหาร</Text>

            <Text style={styles.fieldLabel}>มื้ออาหาร</Text>
            <View style={styles.mealTypeRow}>
              {MEAL_OPTIONS.map((meal) => (
                <TouchableOpacity
                  key={meal}
                  style={[styles.mealTypeChip, form.meal === meal && styles.mealTypeChipActive]}
                  onPress={() => setForm({ ...form, meal })}
                >
                  <Text style={[styles.mealTypeText, form.meal === meal && { color: "#fff" }]}>
                    {meal}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>ชื่ออาหาร</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="เช่น ข้าวไข่เจียว"
              placeholderTextColor="#666"
              keyboardType="default"
              inputMode="text"
              value={form.food}
              onChangeText={(value) => setForm({ ...form, food: value })}
            />

            <View style={styles.macroInputRow}>
              {[
                { key: "kcal", label: "Kcal" },
                { key: "protein", label: "โปรตีน" },
                { key: "carbs", label: "คาร์บ" },
                { key: "fat", label: "ไขมัน" },
              ].map(({ key, label }) => (
                <View key={key} style={styles.macroInputItem}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <TextInput
                    style={styles.modalInputSmall}
                    placeholder="0"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={form[key]}
                    onChangeText={(value) => setForm({ ...form, [key]: value })}
                  />
                </View>
              ))}
            </View>

            <TouchableOpacity style={styles.btnSave} onPress={handleAddMeal} disabled={loading}>
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#f0ece6" },
  badge: { backgroundColor: "#FF6B1A", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  caloriesCard: { margin: 16, backgroundColor: "#1a1a1a", borderRadius: 16, padding: 20, flexDirection: "row", alignItems: "center", gap: 20 },
  calInfo: { flex: 1 },
  calLeft: { fontSize: 28, fontWeight: "700", color: "#f0ece6" },
  calUnit: { fontSize: 16, color: "#888", fontWeight: "400" },
  calSub: { fontSize: 12, color: "#888", marginTop: 4 },
  calRemaining: { fontSize: 13, color: "#4ade80", marginTop: 6 },
  macroCard: { marginHorizontal: 16, marginBottom: 8, gap: 12 },
  macroRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  macroLabel: { fontSize: 12, color: "#888", width: 56 },
  macroBarBg: { flex: 1, height: 6, backgroundColor: "#1e1e1e", borderRadius: 3, overflow: "hidden" },
  macroBarFill: { height: "100%", borderRadius: 3 },
  macroG: { fontSize: 12, color: "#f0ece6", width: 42, textAlign: "right" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#f0ece6" },
  sectionLink: { fontSize: 13, color: "#FF6B1A", fontWeight: "600" },
  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center" },
  mealCard: { marginHorizontal: 16, backgroundColor: "#1a1a1a", borderRadius: 14, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mealName: { fontSize: 14, fontWeight: "600", color: "#f0ece6" },
  mealFood: { fontSize: 12, color: "#888", marginTop: 2 },
  mealMacro: { fontSize: 10, color: "#666", marginTop: 3 },
  mealKcal: { fontSize: 14, fontWeight: "700", color: "#FF6B1A" },
  addMealBtn: { marginHorizontal: 16, marginTop: 8, borderWidth: 1, borderColor: "#2a2a2a", borderStyle: "dashed", borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  addMealText: { color: "#888", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalBox: { backgroundColor: "#1a1a1a", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#f0ece6", marginBottom: 16 },
  fieldLabel: { fontSize: 11, color: "#888", marginBottom: 6, marginTop: 10 },
  mealTypeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  mealTypeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#2a2a2a", backgroundColor: "#1e1e1e" },
  mealTypeChipActive: { backgroundColor: "#FF6B1A", borderColor: "#FF6B1A" },
  mealTypeText: { fontSize: 12, color: "#888" },
  modalInput: { backgroundColor: "#1e1e1e", borderWidth: 1, borderColor: "#2a2a2a", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: "#f0ece6", fontSize: 14 },
  macroInputRow: { flexDirection: "row", gap: 8 },
  macroInputItem: { flex: 1 },
  modalInputSmall: { backgroundColor: "#1e1e1e", borderWidth: 1, borderColor: "#2a2a2a", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, color: "#f0ece6", fontSize: 13 },
  btnSave: { backgroundColor: "#FF6B1A", borderRadius: 12, paddingVertical: 14, alignItems: "center", marginTop: 16 },
  btnSaveText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  btnCancel: { paddingVertical: 12, alignItems: "center", marginTop: 8 },
  btnCancelText: { color: "#888", fontSize: 14 },
});

export default NutritionScreen;
