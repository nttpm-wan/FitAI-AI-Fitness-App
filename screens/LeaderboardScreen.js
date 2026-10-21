import { useEffect, useState } from "react";
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
import { getLeaderboard } from "../firebase/db";

const LeaderboardScreen = ({ navigation }) => {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [activeTab, setActiveTab] = useState("weekly");

  useEffect(() => {
    const bootstrap = async () => {
      const currentUser = await auth.getCurrentUser();
      setUid(currentUser?.uid || currentUser?.id || null);
      await loadLeaderboard();
    };
    bootstrap();
  }, []);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const data = await getLeaderboard();
      setLeaderboard(data);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  const getInitials = (name) => {
    if (!name) return "NA";
    return name
      .split(" ")
      .map((item) => item[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const renderItem = ({ item, index }) => {
    const isMe = item.id === uid;

    if (index < 3) {
      return null;
    }

    return (
      <View style={[styles.rankRow, isMe && styles.rankRowMe]}>
        <Text style={styles.rankNumber}>#{item.rank}</Text>
        <View style={[styles.avatar, isMe && styles.avatarMe]}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>
            {item.name || "User"} {isMe ? <Text style={styles.meText}>(You)</Text> : null}
          </Text>
          <Text style={styles.subText}>{item.workouts || 0} workouts</Text>
        </View>
        <Text style={styles.score}>{(item.score || 0).toLocaleString()}</Text>
      </View>
    );
  };

  const topThree = leaderboard.slice(0, 3);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <TouchableOpacity onPress={loadLeaderboard} disabled={loading}>
          <Text style={styles.refreshButton}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {["weekly", "monthly"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === "weekly" ? "This Week" : "This Month"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {(!initialLoadDone || loading) ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color="#FF6B1A" size="large" />
        </View>
      ) : (
        <FlatList
          data={leaderboard}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          ListHeaderComponent={
            <View style={styles.podiumRow}>
              {topThree.map((item, index) => (
                <View key={item.id} style={[styles.podiumCard, index === 0 && styles.podiumCardWinner]}>
                  <Text style={styles.podiumRank}>#{index + 1}</Text>
                  <View style={styles.podiumAvatar}>
                    <Text style={styles.podiumAvatarText}>{getInitials(item.name)}</Text>
                  </View>
                  <Text style={styles.podiumName}>{item.name || "Player"}</Text>
                  <Text style={styles.podiumScore}>{(item.score || 0).toLocaleString()}</Text>
                </View>
              ))}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No leaderboard data available.</Text>
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
  tabText: { color: "#777", fontSize: 13 },
  tabTextActive: { color: "#fff", fontWeight: "700" },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  podiumRow: { flexDirection: "row", marginBottom: 14 },
  podiumCard: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    marginHorizontal: 4,
  },
  podiumCardWinner: { borderWidth: 1, borderColor: "rgba(255,107,26,0.4)" },
  podiumRank: { color: "#FF6B1A", fontSize: 12, fontWeight: "700", marginBottom: 8 },
  podiumAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  podiumAvatarText: { color: "#f0ece6", fontSize: 18, fontWeight: "700" },
  podiumName: { color: "#f0ece6", fontSize: 13, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  podiumScore: { color: "#888", fontSize: 12 },
  rankRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#1a1a1a", borderRadius: 12, padding: 12 },
  rankRowMe: { borderWidth: 1, borderColor: "rgba(255,107,26,0.35)" },
  rankNumber: { width: 36, color: "#888", fontSize: 14, fontWeight: "700" },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarMe: { backgroundColor: "#FF6B1A" },
  avatarText: { color: "#f0ece6", fontWeight: "700" },
  info: { flex: 1 },
  name: { color: "#f0ece6", fontSize: 14, fontWeight: "600" },
  meText: { color: "#FF6B1A", fontWeight: "700" },
  subText: { color: "#777", fontSize: 11, marginTop: 2 },
  score: { color: "#FF6B1A", fontSize: 14, fontWeight: "700" },
  emptyBox: { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: "#666", fontSize: 14 },
});

export default LeaderboardScreen;
