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
import { getWorkouts } from "../firebase/db";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "strength", label: "Strength" },
  { key: "cardio", label: "Cardio" },
  { key: "flexibility", label: "Flexibility" },
];

const WorkoutHistoryScreen = ({ navigation }) => {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [history, setHistory] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const bootstrap = async () => {
      const currentUser = await auth.getCurrentUser();
      const nextUid = currentUser?.uid || currentUser?.id || null;
      setUid(nextUid);
      await loadHistory(nextUid);
    };
    bootstrap();
  }, []);

  const loadHistory = async (currentUid = uid) => {
    setLoading(true);
    try {
      const data = await getWorkouts(currentUid);
      setHistory(data);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  const filteredHistory = useMemo(
    () => (filter === "all" ? history : history.filter((item) => item.type === filter)),
    [filter, history]
  );

  const totalKcal = history.reduce((sum, item) => sum + (item.kcal || 0), 0);
  const totalMinutes = history.reduce((sum, item) => sum + (item.duration || 0), 0);

  const formatDate = (value) => {
    if (!value) return "-";
    return new Date(value).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.accent} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <Text style={styles.cardMeta}>{formatDate(item.date || item.created_at)}</Text>
        <View style={styles.statsRow}>
          <Text style={styles.cardStat}>{item.duration || 0} min</Text>
          <Text style={styles.cardStat}>{item.kcal || 0} kcal</Text>
          <Text style={styles.cardStat}>{item.sets || 0} sets</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Workout History</Text>
        <TouchableOpacity onPress={() => loadHistory(uid)} disabled={loading}>
          <Text style={styles.refreshButton}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {!initialLoadDone ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color="#FF6B1A" size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredHistory}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListHeaderComponent={
            <>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{history.length}</Text>
                  <Text style={styles.summaryLabel}>sessions</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{totalKcal}</Text>
                  <Text style={styles.summaryLabel}>kcal</Text>
                </View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryValue}>{Math.round(totalMinutes / 60)}h</Text>
                  <Text style={styles.summaryLabel}>time</Text>
                </View>
              </View>

              <View style={styles.filterRow}>
                {FILTERS.map((item) => (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.filterChip, filter === item.key && styles.filterChipActive]}
                    onPress={() => setFilter(item.key)}
                  >
                    <Text style={[styles.filterChipText, filter === item.key && styles.filterChipTextActive]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No workout history yet.</Text>
              <Text style={styles.emptyText}>Complete one workout and it will appear here.</Text>
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
  headerTitle: { color: "#f0ece6", fontSize: 18, fontWeight: "700" },
  refreshButton: { color: "#FF6B1A", fontSize: 13, fontWeight: "600" },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  summaryRow: { flexDirection: "row", marginBottom: 12 },
  summaryCard: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginHorizontal: 4,
  },
  summaryValue: { color: "#f0ece6", fontSize: 22, fontWeight: "800" },
  summaryLabel: { color: "#777", fontSize: 11, marginTop: 4 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 12 },
  filterChip: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: { backgroundColor: "#FF6B1A", borderColor: "#FF6B1A" },
  filterChipText: { color: "#777", fontSize: 12 },
  filterChipTextActive: { color: "#fff", fontWeight: "700" },
  card: { flexDirection: "row", backgroundColor: "#1a1a1a", borderRadius: 14, overflow: "hidden" },
  accent: { width: 4, backgroundColor: "#FF6B1A" },
  cardBody: { flex: 1, padding: 14 },
  cardTitle: { color: "#f0ece6", fontSize: 15, fontWeight: "700", marginBottom: 4 },
  cardMeta: { color: "#888", fontSize: 12, marginBottom: 10 },
  statsRow: { flexDirection: "row", flexWrap: "wrap" },
  cardStat: { color: "#666", fontSize: 11, marginRight: 12 },
  emptyBox: { alignItems: "center", paddingVertical: 56 },
  emptyTitle: { color: "#666", fontSize: 15, fontWeight: "600", marginBottom: 4 },
  emptyText: { color: "#444", fontSize: 12 },
});

export default WorkoutHistoryScreen;
