import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../firebase/config";
import {
  getChallenges,
  getJoinedChallenges,
  joinChallenge,
  leaveChallenge,
} from "../firebase/db";

const TAB_OPTIONS = [
  { key: "active", label: "Active" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

const ChallengesScreen = ({ navigation }) => {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [challenges, setChallenges] = useState([]);
  const [joinedIds, setJoinedIds] = useState([]);
  const [activeTab, setActiveTab] = useState("active");
  const [joiningId, setJoiningId] = useState(null);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const currentUser = await auth.getCurrentUser();
      const nextUid = currentUser?.uid || currentUser?.id || null;
      if (mounted) {
        setUid(nextUid);
      }
      await loadChallenges(nextUid);
    };

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  const loadChallenges = async (currentUid = uid) => {
    setLoading(true);
    try {
      const [challengeData, joinedData] = await Promise.all([
        getChallenges(),
        getJoinedChallenges(currentUid),
      ]);
      setChallenges(challengeData);
      setJoinedIds(joinedData);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  const handleJoinToggle = async (challenge) => {
    if (!uid) {
      Alert.alert("Login Required", "Please log in before joining a challenge.");
      return;
    }

    const isJoined = joinedIds.includes(challenge.id);
    setJoiningId(challenge.id);

    try {
      if (isJoined) {
        await leaveChallenge(uid, challenge.id);
        setJoinedIds((prev) => prev.filter((item) => item !== challenge.id));
      } else {
        await joinChallenge(uid, challenge.id);
        setJoinedIds((prev) => [...prev, challenge.id]);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setJoiningId(null);
    }
  };

  const filteredChallenges = useMemo(
    () => challenges.filter((challenge) => challenge.category === activeTab),
    [activeTab, challenges]
  );

  const renderItem = ({ item }) => {
    const isJoined = joinedIds.includes(item.id);
    const isProcessing = joiningId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={styles.iconBox}>
            <Text style={styles.icon}>{item.icon || "Flag"}</Text>
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDesc}>{item.desc}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaText}>{(item.members || 0).toLocaleString()} members</Text>
              <Text style={styles.metaText}>{item.daysLeft || 0} days left</Text>
              <Text style={styles.rewardText}>{item.reward}</Text>
            </View>
          </View>
        </View>

        {item.progress > 0 ? (
          <View style={styles.progressRow}>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${Math.min(item.progress * 100, 100)}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(item.progress * 100)}%</Text>
          </View>
        ) : null}

        {item.category === "completed" ? (
          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>Completed</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.joinButton, isJoined && styles.joinButtonOutline]}
            onPress={() => handleJoinToggle(item)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color={isJoined ? "#FF6B1A" : "#fff"} size="small" />
            ) : (
              <Text style={[styles.joinButtonText, isJoined && styles.joinButtonTextOutline]}>
                {isJoined ? "Leave" : "Join"}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Challenges</Text>
        <TouchableOpacity onPress={() => loadChallenges(uid)} disabled={loading}>
          <Text style={styles.refreshButton}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {TAB_OPTIONS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!initialLoadDone ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color="#FF6B1A" size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredChallenges}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No challenges in this tab.</Text>
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
  tabRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 4,
  },
  tabButton: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 10 },
  tabButtonActive: { backgroundColor: "#FF6B1A" },
  tabText: { color: "#777", fontSize: 12 },
  tabTextActive: { color: "#fff", fontWeight: "700" },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: { backgroundColor: "#1a1a1a", borderRadius: 14, padding: 16 },
  cardTop: { flexDirection: "row" },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  icon: { fontSize: 18, color: "#ddd" },
  cardInfo: { flex: 1 },
  cardTitle: { color: "#f0ece6", fontSize: 15, fontWeight: "700", marginBottom: 4 },
  cardDesc: { color: "#9a9a9a", fontSize: 12, marginBottom: 8, lineHeight: 18 },
  metaRow: { flexDirection: "row", flexWrap: "wrap" },
  metaText: { color: "#777", fontSize: 11, marginRight: 10 },
  rewardText: { color: "#FF6B1A", fontSize: 11, fontWeight: "600" },
  progressRow: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  progressBg: {
    flex: 1,
    height: 6,
    backgroundColor: "#242424",
    borderRadius: 999,
    overflow: "hidden",
    marginRight: 8,
  },
  progressFill: { height: "100%", backgroundColor: "#FF6B1A" },
  progressText: { color: "#FF6B1A", fontSize: 11, fontWeight: "600" },
  joinButton: {
    marginTop: 14,
    backgroundColor: "#FF6B1A",
    borderRadius: 10,
    alignItems: "center",
    paddingVertical: 11,
  },
  joinButtonOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#FF6B1A" },
  joinButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  joinButtonTextOutline: { color: "#FF6B1A" },
  completedBadge: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "rgba(74,222,128,0.12)",
    borderRadius: 10,
  },
  completedText: { color: "#4ade80", fontSize: 13, fontWeight: "700" },
  emptyBox: { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: "#666", fontSize: 14 },
});

export default ChallengesScreen;
