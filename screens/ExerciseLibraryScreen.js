import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, TextInput, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import exerciseCatalog from "../exercise_api/exercises.json";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_EXERCISE_API_BASE_URL ||
  (Platform.OS === "android" ? "http://10.0.2.2:8001" : "http://127.0.0.1:8001");

const ExerciseLibraryScreen = ({ navigation }) => {
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [exercises, setExercises] = useState([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const categories = [
    { key: "all", label: "ทั้งหมด" },
    { key: "chest", label: "💪 อก" },
    { key: "back", label: "🔙 หลัง" },
    { key: "legs", label: "🦵 ขา" },
    { key: "core", label: "🎯 แกนกลาง" },
    { key: "arms", label: "💪 แขน" },
    { key: "shoulders", label: "🙆 ไหล่" },
    { key: "cardio", label: "🏃 คาร์ดิโอ" },
  ];

  const levelColor = { Beginner: "#4ade80", Intermediate: "#facc15", Advanced: "#f87171" };

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const fetchExercises = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/exercises`, { signal: controller.signal });
        if (!response.ok) throw new Error(`Exercise API returned ${response.status}`);
        const payload = await response.json();
        if (mounted && Array.isArray(payload?.exercises)) setExercises(payload.exercises);
      } catch (error) {
        if (mounted && error?.name !== "AbortError") setExercises(exerciseCatalog);
      } finally {
        if (mounted) setInitialLoadDone(true);
      }
    };

    fetchExercises();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const filtered = exercises.filter((e) => {
    const matchCat = activeCategory === "all" || e.category === activeCategory;
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.muscle.includes(search);
    return matchCat && matchSearch;
  });

  const renderExercise = ({ item }) => (
    <TouchableOpacity
      style={styles.exerciseCard}
      onPress={() => navigation.navigate("WorkoutDetail", { exercise: item })}
    >
      <View style={styles.exerciseIcon}>
        <Text style={styles.exerciseIconText}>{item.icon}</Text>
      </View>
      <View style={styles.exerciseInfo}>
        <View style={styles.exerciseTop}>
          <Text style={styles.exerciseName}>{item.name}</Text>
          <View style={[styles.levelBadge, { backgroundColor: `${levelColor[item.level]}20` }]}>
            <Text style={[styles.levelText, { color: levelColor[item.level] }]}>{item.level}</Text>
          </View>
        </View>
        <Text style={styles.exerciseMuscle}>กล้ามเนื้อ: {item.muscle}</Text>
        <View style={styles.exerciseMeta}>
          <Text style={styles.exerciseMetaText}>📋 {item.sets} เซต</Text>
          <Text style={styles.exerciseMetaText}>🔁 {item.reps} ครั้ง</Text>
          <Text style={styles.exerciseMetaText}>🔥 ~{item.kcal} kcal</Text>
        </View>
      </View>
      <Text style={styles.exerciseArrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>‹ กลับ</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Exercise Library</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Search */}
      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="ค้นหาท่าออกกำลังกาย..."
          placeholderTextColor="#555"
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Category Filter */}
      <FlatList
        data={categories}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.key}
        style={styles.categoryFlatList}
        contentContainerStyle={styles.categoryList}
        ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.categoryChip, activeCategory === item.key && styles.categoryChipActive]}
            onPress={() => setActiveCategory(item.key)}
            activeOpacity={0.85}
          >
            <Text style={[styles.categoryText, activeCategory === item.key && styles.categoryTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {!initialLoadDone ? (
        <View style={styles.loadingCenter}><ActivityIndicator color="#FF6B1A" size="large" /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderExercise}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={styles.emptyText}>ไม่พบท่าออกกำลังกาย</Text>}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { fontSize: 16, color: "#FF6B1A", fontWeight: "600" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#f0ece6" },
  searchBox: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 10, backgroundColor: "#1a1a1a", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: "#f0ece6", fontSize: 14 },
  categoryFlatList: { flexGrow: 0, maxHeight: 58 },
  categoryList: { paddingHorizontal: 16, paddingBottom: 10, alignItems: "center" },
  categoryChip: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2f2f2f",
    backgroundColor: "#181818",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryChipActive: {
    backgroundColor: "#FF6B1A",
    borderColor: "#FF6B1A",
    shadowColor: "#FF6B1A",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  categoryText: { fontSize: 13, color: "#8a8a8a", fontWeight: "600" },
  categoryTextActive: { color: "#fff", fontWeight: "700" },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  exerciseCard: { flexDirection: "row", backgroundColor: "#1a1a1a", borderRadius: 14, padding: 14, alignItems: "center", gap: 12 },
  exerciseIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: "#1e1e1e", alignItems: "center", justifyContent: "center" },
  exerciseIconText: { fontSize: 24 },
  exerciseInfo: { flex: 1 },
  exerciseTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  exerciseName: { fontSize: 15, fontWeight: "700", color: "#f0ece6" },
  levelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  levelText: { fontSize: 10, fontWeight: "600" },
  exerciseMuscle: { fontSize: 12, color: "#666", marginBottom: 6 },
  exerciseMeta: { flexDirection: "row", gap: 10 },
  exerciseMetaText: { fontSize: 11, color: "#555" },
  exerciseArrow: { fontSize: 20, color: "#444" },
  emptyText: { textAlign: "center", color: "#555", marginTop: 40, fontSize: 14 },
});

export default ExerciseLibraryScreen;
