import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../firebase/config"; 
import { getUser, getRecentWorkouts } from "../firebase/db";

const HomeScreen = ({ navigation }) => {
  const [profile, setProfile] = useState(null);
  const [workouts, setWorkouts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [uid, setUid] = useState(null);

  // 1. ดึง Session ทันทีที่เปิดแอป
  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUid(session.user.id);
      }
    };
    getSession();
  }, []);

  // 2. โหลดข้อมูลเมื่อมี uid แล้วเท่านั้น (แก้หน้าจอแดง UUID null)
  const loadData = useCallback(async () => {
    if (!uid) return; // ป้องกันการส่งค่า null ไปที่ Supabase

    setLoading(true);
    try {
      const [user, logs] = await Promise.all([
        getUser(uid),
        getRecentWorkouts(uid, 5),
      ]);
      
      setProfile(user);
      setWorkouts(logs && logs.length > 0 ? logs : SAMPLE_WORKOUTS);
    } catch (e) {
      console.error("Load Data Error:", e);
      setWorkouts(SAMPLE_WORKOUTS);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      if (!uid) return undefined;
      loadData();
      return undefined;
    }, [uid, loadData])
  );

  const handleStartWorkout = async (item) => {
    navigation.navigate("WorkoutDetail", {
      exercise: { name: item.name, icon: "🏋️", muscle: item.muscle || "ทั้งตัว", level: item.level, sets: item.sets || "4", reps: item.reps || "12", kcal: item.kcal },
    });
  };

  // ดึงชื่อจริงๆ จาก Profile ถ้าไม่มีให้แสดงชื่อเริ่มต้น
  const displayName = profile?.name || "Athlete";

  const RingChart = ({ size, radius, progress, color, bgColor }) => {
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progress);
    return (
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={bgColor} strokeWidth={7} />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    );
  };

  const totalKcal = workouts.reduce((s, w) => s + (w.kcal || 0), 0);
  const totalMin = workouts.reduce((s, w) => s + (w.duration || 0), 0);

  const renderWorkout = ({ item }) => (
    <View style={styles.workoutCard}>
      <View style={styles.workoutAccent} />
      <View style={styles.workoutBody}>
        <Text style={styles.workoutName}>{item.name}</Text>
        <Text style={styles.workoutMeta}>
          {item.duration} นาที · {item.level || "Intermediate"} · {item.kcal} kcal
        </Text>
        <View style={styles.tag}>
          <Text style={styles.tagText}>{item.tag || "💪 Workout"}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.workoutArrow} onPress={() => handleStartWorkout(item)}>
        <Text style={styles.workoutArrowText}>›</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greetingSub}>Good morning,</Text>
            <Text style={styles.greetingName}>{displayName} 👋</Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => navigation.navigate("Profile")}>
            <Text style={styles.avatarText}>{displayName?.charAt(0) || "A"}</Text>
          </TouchableOpacity>
        </View>

        {/* Activity Rings */}
        <View style={styles.ringsCard}>
          <View style={styles.ringsWrapper}>
            <View style={{ position: "absolute" }}>
              <RingChart size={100} radius={44} progress={Math.min(totalKcal / 3000, 1)} color="#FF6B1A" bgColor="#1e1e1e" />
            </View>
            <View style={{ position: "absolute", top: 7, left: 7 }}>
              <RingChart size={86} radius={36} progress={Math.min(totalMin / 120, 1)} color="#FF8C3A" bgColor="#1e1e1e" />
            </View>
            <View style={{ position: "absolute", top: 14, left: 14 }}>
              <RingChart size={72} radius={28} progress={Math.min(workouts.length / 5, 1)} color="#ffa040" bgColor="#1e1e1e" />
            </View>
          </View>
          <View style={styles.ringsInfo}>
            <Text style={styles.ringsLabel}>Today's Activity</Text>
            <Text style={styles.ringsValue}>{totalKcal.toLocaleString()}</Text>
            <Text style={styles.ringsSub}>Cal burned (สะสม)</Text>
            {/* แก้จาก <div> เป็น <View> เพื่อไม่ให้แอปพัง */}
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Text style={styles.statNumber}>{totalMin}<Text style={styles.statUnit}>min</Text></Text>
                <Text style={styles.statLabel}>Total</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statNumber}>{workouts.length}<Text style={styles.statUnit}>x</Text></Text>
                <Text style={styles.statLabel}>Workouts</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Workouts</Text>
          <TouchableOpacity onPress={loadData} disabled={loading}>
            {loading ? <ActivityIndicator color="#FF6B1A" size="small" /> : <Text style={styles.sectionLink}>Refresh</Text>}
          </TouchableOpacity>
        </View>

        {!initialLoadDone ? (
          <View style={styles.loadingBox}><ActivityIndicator color="#FF6B1A" /></View>
        ) : (
          <FlatList
            data={workouts}
            keyExtractor={(item, i) => item.id || String(i)}
            renderItem={renderWorkout}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          />
        )}

        <TouchableOpacity style={styles.btnStart} onPress={() => navigation.navigate("ExerciseLibrary")}>
          <Text style={styles.btnStartText}>Start Workout →</Text>
        </TouchableOpacity>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const SAMPLE_WORKOUTS = [
  { id: "s1", name: "Full Body Blast", duration: 45, level: "Intermediate", kcal: 380, tag: "🔥 Trending" },
  { id: "s2", name: "Morning Spine Mobility", duration: 20, level: "Beginner", kcal: 120, tag: "⚡ Quick" },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  greetingSub: { fontSize: 13, color: "#666" },
  greetingName: { fontSize: 20, fontWeight: "700", color: "#f0ece6" },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FF6B1A", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  ringsCard: { margin: 16, backgroundColor: "#1a1a1a", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", gap: 16 },
  ringsWrapper: { width: 100, height: 100, position: "relative" },
  ringsInfo: { flex: 1 },
  ringsLabel: { fontSize: 11, color: "#666", marginBottom: 2 },
  ringsValue: { fontSize: 24, fontWeight: "700", color: "#f0ece6" },
  ringsSub: { fontSize: 12, color: "#666", marginBottom: 10 },
  statsRow: { flexDirection: "row", gap: 8 },
  statPill: { flex: 1, backgroundColor: "#1e1e1e", borderRadius: 10, padding: 10 },
  statNumber: { fontSize: 16, fontWeight: "700", color: "#f0ece6" },
  statUnit: { fontSize: 10, color: "#666" },
  statLabel: { fontSize: 10, color: "#666", marginTop: 2 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#f0ece6" },
  sectionLink: { fontSize: 13, color: "#FF6B1A" },
  loadingBox: { paddingVertical: 30, alignItems: "center" },
  workoutCard: { marginHorizontal: 16, backgroundColor: "#1a1a1a", borderRadius: 14, flexDirection: "row", alignItems: "center", overflow: "hidden" },
  workoutAccent: { width: 4, backgroundColor: "#FF6B1A", alignSelf: "stretch" },
  workoutBody: { flex: 1, padding: 14 },
  workoutName: { fontSize: 15, fontWeight: "600", color: "#f0ece6", marginBottom: 4 },
  workoutMeta: { fontSize: 12, color: "#666" },
  tag: { backgroundColor: "rgba(255,107,26,0.15)", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, marginTop: 6 },
  tagText: { fontSize: 10, color: "#FF6B1A" },
  workoutArrow: { paddingHorizontal: 14 },
  workoutArrowText: { fontSize: 22, color: "#444" },
  btnStart: { marginHorizontal: 16, marginTop: 16, backgroundColor: "#FF6B1A", borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  btnStartText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

export default HomeScreen;
