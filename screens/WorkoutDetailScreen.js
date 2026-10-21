import { useEffect, useRef, useState } from "react";
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
import { addWorkout } from "../firebase/db";

const WorkoutDetailScreen = ({ navigation, route }) => {
  const exercise = route?.params?.exercise || {
    name: "Full Body Blast",
    icon: "W",
    muscle: "Full Body",
    level: "Intermediate",
    sets: "4",
    reps: "12",
    kcal: 380,
  };

  const [uid, setUid] = useState(null);
  const [saving, setSaving] = useState(false);
  const [currentSet, setCurrentSet] = useState(1);
  const [completedSets, setCompletedSets] = useState([]);
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [workoutStarted, setWorkoutStarted] = useState(false);
  const [setElapsedSeconds, setSetElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const restTimerRef = useRef(null);
  const setTimerRef = useRef(null);

  const totalSets = parseInt(exercise.sets, 10) || 4;
  const targetReps = parseInt(exercise.reps, 10) || 12;
  const restDuration = 60;

  const clearIntervalRef = (ref) => {
    if (ref.current) {
      clearInterval(ref.current);
      ref.current = null;
    }
  };

  useEffect(() => {
    auth.getCurrentUser().then((user) => setUid(user?.uid || user?.id || null));
    return () => {
      clearIntervalRef(restTimerRef);
      clearIntervalRef(setTimerRef);
    };
  }, []);

  const formatSeconds = (seconds) => {
    const minute = String(Math.floor(seconds / 60)).padStart(2, "0");
    const second = String(seconds % 60).padStart(2, "0");
    return `${minute}:${second}`;
  };

  const stopSetTimer = () => {
    clearIntervalRef(setTimerRef);
  };

  const startSetTimer = () => {
    clearIntervalRef(setTimerRef);
    setSetElapsedSeconds(0);
    setTimerRef.current = setInterval(() => {
      setSetElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  const startRestTimer = (onDone) => {
    setIsResting(true);
    setRestTimer(restDuration);
    clearIntervalRef(restTimerRef);
    restTimerRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (prev <= 1) {
          clearIntervalRef(restTimerRef);
          setIsResting(false);
          onDone?.();
          startSetTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleStartWorkout = () => {
    clearIntervalRef(restTimerRef);
    stopSetTimer();
    setWorkoutStarted(true);
    setCurrentSet(1);
    setCompletedSets([]);
    setIsResting(false);
    setRestTimer(0);
    setSetElapsedSeconds(0);
    setStartTime(Date.now());
    startSetTimer();
  };

  const handleCompleteSet = async () => {
    if (!workoutStarted || isResting) return;

    setSaving(true);
    try {
      const performedSeconds = Math.max(setElapsedSeconds, 1);
      const nextCompleted = [
        ...completedSets,
        { set: currentSet, reps: targetReps, seconds: performedSeconds },
      ];
      setCompletedSets(nextCompleted);
      stopSetTimer();

      if (currentSet < totalSets) {
        startRestTimer(() => setCurrentSet((prev) => prev + 1));
        return;
      }

      if (!uid) {
        Alert.alert("Login Required", "Please log in before saving workout data.");
        return;
      }

      const durationMin = startTime
        ? Math.max(1, Math.round((Date.now() - startTime) / 60000))
        : Math.round(totalSets * (targetReps * 3 + restDuration) / 60);

      await addWorkout(uid, {
        name: exercise.name,
        type: exercise.type || "strength",
        level: exercise.level || "Intermediate",
        muscle: exercise.muscle || "Full Body",
        sets: totalSets,
        reps: targetReps,
        kcal: exercise.kcal || 0,
        duration: durationMin,
        tag: exercise.tag || "Workout",
      });

      Alert.alert("Saved", `${exercise.name} has been saved.`);
      navigation.goBack();
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setSaving(false);
    }
  };

  const steps = [
    "Warm up for 5 minutes",
    `Perform ${exercise.name} for ${targetReps} reps`,
    `Rest for ${restDuration} seconds`,
    `Repeat until ${totalSets} sets are done`,
    "Cool down and stretch",
  ];

  const levelColor = {
    Beginner: "#4ade80",
    Intermediate: "#facc15",
    Advanced: "#f87171",
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout Detail</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroIcon}>{exercise.icon || "W"}</Text>
          <Text style={styles.heroName}>{exercise.name}</Text>
          <Text style={styles.heroMuscle}>Muscle Group: {exercise.muscle}</Text>
          <View style={[styles.levelBadge, { backgroundColor: `${levelColor[exercise.level] || "#888"}20` }]}>
            <Text style={[styles.levelText, { color: levelColor[exercise.level] || "#888" }]}>
              {exercise.level}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{exercise.sets}</Text>
              <Text style={styles.statLabel}>Sets</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{exercise.reps}</Text>
              <Text style={styles.statLabel}>Reps</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{exercise.kcal}</Text>
              <Text style={styles.statLabel}>kcal</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.poseAiButton}
            onPress={() =>
              navigation.navigate("CameraAI", {
                exerciseName: exercise.name,
              })
            }
          >
            <Text style={styles.poseAiButtonText}>Open Pose AI Camera</Text>
          </TouchableOpacity>
        </View>

        {workoutStarted ? (
          <View style={styles.trackerCard}>
            <Text style={styles.trackerTitle}>Set {currentSet} / {totalSets}</Text>
            {isResting ? (
              <Text style={styles.trackerSubTitle}>
                Rest before Set {Math.min(currentSet + 1, totalSets)}
              </Text>
            ) : (
              <Text style={styles.trackerSubTitle}>
                Set timer: {formatSeconds(setElapsedSeconds)}
              </Text>
            )}
            <View style={styles.dotRow}>
              {Array.from({ length: totalSets }).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index < completedSets.length && styles.dotDone,
                    index === completedSets.length && styles.dotCurrent,
                  ]}
                />
              ))}
            </View>

            {isResting ? (
              <View style={styles.restBox}>
                <Text style={styles.restLabel}>Resting</Text>
                <Text style={styles.restTimer}>{restTimer}s</Text>
              </View>
            ) : (
              <TouchableOpacity style={styles.completeButton} onPress={handleCompleteSet} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.completeButtonText}>Complete Set</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>How To</Text>
          {steps.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Tips</Text>
          <Text style={styles.tipText}>Keep your form stable and breathe during each rep.</Text>
          <Text style={styles.tipText}>Stop if you feel unusual pain.</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {!workoutStarted ? (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.startButton} onPress={handleStartWorkout}>
            <Text style={styles.startButtonText}>Start Workout</Text>
          </TouchableOpacity>
        </View>
      ) : null}
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
  headerTitle: { color: "#f0ece6", fontSize: 18, fontWeight: "700" },
  heroCard: { margin: 16, backgroundColor: "#1a1a1a", borderRadius: 16, padding: 22, alignItems: "center" },
  heroIcon: { fontSize: 40, marginBottom: 10, color: "#fff" },
  heroName: { color: "#f0ece6", fontSize: 24, fontWeight: "800", marginBottom: 4 },
  heroMuscle: { color: "#888", fontSize: 13, marginBottom: 12 },
  levelBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginBottom: 18 },
  levelText: { fontSize: 12, fontWeight: "700" },
  statsRow: { flexDirection: "row", width: "100%" },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { color: "#f0ece6", fontSize: 22, fontWeight: "800" },
  statLabel: { color: "#777", fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: "#2a2a2a" },
  poseAiButton: {
    marginTop: 16,
    backgroundColor: "#121212",
    borderWidth: 1,
    borderColor: "#303030",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  poseAiButtonText: { color: "#FF6B1A", fontSize: 13, fontWeight: "700" },
  trackerCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: "#1a1a1a", borderRadius: 16, padding: 20 },
  trackerTitle: { color: "#f0ece6", fontSize: 16, fontWeight: "700", textAlign: "center", marginBottom: 16 },
  trackerSubTitle: { color: "#888", fontSize: 13, textAlign: "center", marginTop: -10, marginBottom: 12 },
  dotRow: { flexDirection: "row", justifyContent: "center", marginBottom: 16 },
  dot: { width: 14, height: 14, borderRadius: 7, backgroundColor: "#2a2a2a", marginHorizontal: 5 },
  dotDone: { backgroundColor: "#4ade80" },
  dotCurrent: { backgroundColor: "#FF6B1A" },
  restBox: { alignItems: "center", paddingVertical: 6 },
  restLabel: { color: "#888", fontSize: 13, marginBottom: 8 },
  restTimer: { color: "#FF6B1A", fontSize: 46, fontWeight: "800" },
  completeButton: { backgroundColor: "#FF6B1A", borderRadius: 12, alignItems: "center", paddingVertical: 14 },
  completeButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  sectionCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: "#1a1a1a", borderRadius: 16, padding: 16 },
  sectionTitle: { color: "#f0ece6", fontSize: 15, fontWeight: "700", marginBottom: 12 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 12 },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,107,26,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepNumberText: { color: "#FF6B1A", fontSize: 12, fontWeight: "700" },
  stepText: { flex: 1, color: "#ccc", fontSize: 13, lineHeight: 20 },
  tipText: { color: "#999", fontSize: 13, lineHeight: 22, marginBottom: 4 },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: "#0d0d0d",
    borderTopWidth: 1,
    borderTopColor: "#1a1a1a",
  },
  startButton: { backgroundColor: "#FF6B1A", borderRadius: 14, alignItems: "center", paddingVertical: 16 },
  startButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});

export default WorkoutDetailScreen;
