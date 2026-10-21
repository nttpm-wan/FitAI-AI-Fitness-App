import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../firebase/config";
import {
  addPost,
  getChallenges,
  getJoinedChallenges,
  getUser,
  joinChallenge,
  leaveChallenge,
  subscribeToPosts,
  toggleLike,
} from "../firebase/db";

const CommunityScreen = () => {
  const [uid, setUid] = useState(null);
  const [posts, setPosts] = useState([]);
  const [profile, setProfile] = useState(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState(null);
  const [joined, setJoined] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [postText, setPostText] = useState("");
  const unsubRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      const currentUser = await auth.getCurrentUser();
      const nextUid = currentUser?.uid || currentUser?.id || null;
      if (mounted) {
        setUid(nextUid);
      }
      if (nextUid) {
        await Promise.all([loadProfile(nextUid), loadChallenge(nextUid)]);
      }
    };

    bootstrap();
    unsubRef.current = subscribeToPosts((data) => {
      setPosts(data);
      setInitialLoadDone(true);
    });

    return () => {
      mounted = false;
      unsubRef.current?.();
    };
  }, []);

  const loadProfile = async (currentUid = uid) => {
    if (!currentUid) return;
    const user = await getUser(currentUid);
    setProfile(user);
  };

  const loadChallenge = async (currentUid = uid) => {
    const challenges = await getChallenges();
    const activeChallenge = challenges.find((item) => item.category === "active") || null;
    setChallenge(activeChallenge);
    if (!activeChallenge || !currentUid) {
      setJoined(false);
      return;
    }
    const joinedChallenges = await getJoinedChallenges(currentUid);
    setJoined(joinedChallenges.includes(activeChallenge.id));
  };

  const handleAddPost = async () => {
    if (!postText.trim()) return;
    if (!uid) {
      Alert.alert("Login Required", "Please log in before creating a post.");
      return;
    }

    setLoading(true);
    try {
      const name = profile?.name || "User";
      const initials = name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
      await addPost(uid, postText.trim(), name, initials || "US");
      setPostText("");
      setModalVisible(false);
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleLike = async (postId) => {
    if (!uid) {
      Alert.alert("Login Required", "Please log in before liking a post.");
      return;
    }

    try {
      await toggleLike(postId, uid);
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const handleJoinChallenge = async () => {
    if (!challenge) return;
    if (!uid) {
      Alert.alert("Login Required", "Please log in before joining a challenge.");
      return;
    }

    try {
      if (joined) {
        await leaveChallenge(uid, challenge.id);
        setJoined(false);
      } else {
        await joinChallenge(uid, challenge.id);
        setJoined(true);
      }
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const formatTime = (value) => {
    if (!value) return "just now";
    const date = new Date(value);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  const renderItem = ({ item }) => {
    const isLiked = (item.likes || []).includes(uid);
    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={[styles.avatar, { backgroundColor: item.avatarColor || "#FF6B1A" }]}>
            <Text style={styles.avatarText}>{item.userInitials || "US"}</Text>
          </View>
          <View style={styles.postMeta}>
            <Text style={styles.postName}>{item.userName}</Text>
            <Text style={styles.postTime}>{formatTime(item.createdAt)}</Text>
          </View>
        </View>
        <Text style={styles.postContent}>{item.content}</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity onPress={() => handleToggleLike(item.id)}>
            <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>
              Likes {(item.likes || []).length}
            </Text>
          </TouchableOpacity>
          <Text style={styles.actionText}>Comments {item.comments || 0}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {!initialLoadDone ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color="#FF6B1A" size="large" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListHeaderComponent={
            <>
              <View style={styles.header}>
                <Text style={styles.headerTitle}>Community Feed</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)}>
                  <Text style={styles.postButton}>Add Post</Text>
                </TouchableOpacity>
              </View>

              {challenge ? (
                <View style={styles.challengeCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.challengeTitle}>{challenge.title}</Text>
                    <Text style={styles.challengeSub}>
                      {(challenge.members || 0).toLocaleString()} members | {challenge.daysLeft || 0} days left
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.joinButton, joined && styles.joinButtonOutline]}
                    onPress={handleJoinChallenge}
                  >
                    <Text style={[styles.joinButtonText, joined && styles.joinButtonTextOutline]}>
                      {joined ? "Leave" : "Join"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>No posts yet. Create the first one today.</Text>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Share an update</Text>
            <TextInput
              style={styles.input}
              value={postText}
              onChangeText={setPostText}
              placeholder="Write about your workout today"
              placeholderTextColor="#666"
              keyboardType="default"
              inputMode="text"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity style={styles.saveButton} onPress={handleAddPost} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Post</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
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
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerTitle: { color: "#f0ece6", fontSize: 20, fontWeight: "700" },
  postButton: { color: "#FF6B1A", fontSize: 14, fontWeight: "600" },
  challengeCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  challengeTitle: { color: "#f0ece6", fontSize: 15, fontWeight: "700", marginBottom: 4 },
  challengeSub: { color: "#888", fontSize: 12 },
  joinButton: {
    backgroundColor: "#FF6B1A",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  joinButtonOutline: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#FF6B1A" },
  joinButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  joinButtonTextOutline: { color: "#FF6B1A" },
  postCard: { backgroundColor: "#1a1a1a", borderRadius: 14, padding: 14 },
  postHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  avatarText: { color: "#fff", fontWeight: "700" },
  postMeta: { flex: 1 },
  postName: { color: "#f0ece6", fontSize: 14, fontWeight: "700" },
  postTime: { color: "#777", fontSize: 11, marginTop: 2 },
  postContent: { color: "#d0d0d0", fontSize: 14, lineHeight: 21 },
  actionRow: { flexDirection: "row", marginTop: 12 },
  actionText: { color: "#888", fontSize: 12, marginRight: 16 },
  actionTextActive: { color: "#FF6B1A", fontWeight: "700" },
  emptyBox: { alignItems: "center", paddingVertical: 48 },
  emptyText: { color: "#666", fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalBox: {
    backgroundColor: "#1a1a1a",
    padding: 24,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 40,
  },
  modalTitle: { color: "#f0ece6", fontSize: 18, fontWeight: "700", marginBottom: 12 },
  input: {
    backgroundColor: "#202020",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    minHeight: 110,
    padding: 14,
    color: "#f0ece6",
    fontSize: 14,
  },
  saveButton: {
    marginTop: 14,
    backgroundColor: "#FF6B1A",
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 14,
  },
  saveButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cancelButton: { alignItems: "center", paddingVertical: 14 },
  cancelButtonText: { color: "#888", fontSize: 14 },
});

export default CommunityScreen;
