import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const LOCAL_DEFAULT_API_BASE_URL =
  Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://127.0.0.1:8000";

const DEFAULT_API_BASE_URL =
  process.env.EXPO_PUBLIC_POSE_API_BASE_URL ||
  process.env.EXPO_PUBLIC_CAMERA_SERVER_URL ||
  LOCAL_DEFAULT_API_BASE_URL;

const SUPPORTED_EXERCISES = [
  { key: "squat", label: "Squat" },
  { key: "pushup", label: "Push-up" },
];

const normalizeExerciseName = (value = "") =>
  String(value).toLowerCase().trim().replace(/[\s_-]+/g, "");

const toSupportedExerciseKey = (value = "") => {
  const normalized = normalizeExerciseName(value);
  if (!normalized) return null;
  if (normalized.includes("squat")) return "squat";
  if (normalized.includes("pushup")) return "pushup";
  return null;
};

const resolveInterval = (fpsValue, fallbackMs) => {
  const fps = Number(fpsValue);
  if (!Number.isFinite(fps) || fps <= 0) return fallbackMs;
  return Math.max(33, Math.round(1000 / fps));
};

const PREVIEW_INTERVAL_MS = resolveInterval(
  process.env.EXPO_PUBLIC_POSE_PREVIEW_FPS || 6,
  167
);
const METRIC_INTERVAL_MS = resolveInterval(
  process.env.EXPO_PUBLIC_POSE_METRIC_FPS || 3,
  333
);
const MESSAGE_INTERVAL_MS = resolveInterval(
  process.env.EXPO_PUBLIC_POSE_MESSAGE_FPS || 6,
  167
);

const normalizeBaseUrl = (value = "") => value.trim().replace(/\/+$/, "");

const buildStreamUrl = (baseUrl) => {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) return "";
  return `${normalized.replace(/^http/i, "ws")}/stream`;
};

const devLog = (...args) => {
  if (__DEV__) {
    console.log("[CameraAI]", ...args);
  }
};

const getConnectionLabel = (status) => {
  if (status === "connected") return "Connected";
  if (status === "connecting") return "Connecting...";
  if (status === "error") return "Connection Error";
  return "Disconnected";
};

const resolveExerciseFromRoute = (routeExerciseKey, routeExerciseName) => {
  const directKey = String(routeExerciseKey || "").toLowerCase().trim();
  if (directKey === "squat" || directKey === "pushup") return directKey;

  const byName = String(routeExerciseName || "").toLowerCase();
  if (byName.includes("push")) return "pushup";
  if (byName.includes("squat")) return "squat";
  return "squat";
};

const CameraAIScreen = ({ navigation, route }) => {
  const initialExercise = resolveExerciseFromRoute(
    route?.params?.exerciseKey,
    route?.params?.exerciseName
  );
  const socketRef = useRef(null);
  const connectionIdRef = useRef(0);
  const closedByUserRef = useRef(false);
  const lastPreviewUpdateRef = useRef(0);
  const lastMetricUpdateRef = useRef(0);
  const lastMessageProcessRef = useRef(0);
  const isFrameLoadingRef = useRef(false);
  const queuedFrameUriRef = useRef("");

  const [baseUrl, setBaseUrl] = useState(DEFAULT_API_BASE_URL);
  const [pairingCode, setPairingCode] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("idle");
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [exerciseLoadState, setExerciseLoadState] = useState("idle");
  const [selectedExercise, setSelectedExercise] = useState(initialExercise);
  const [serverExerciseMap, setServerExerciseMap] = useState({});
  const [frameUri, setFrameUri] = useState("");
  const [poseDetected, setPoseDetected] = useState(false);
  const [repCount, setRepCount] = useState(0);
  const [phase, setPhase] = useState("-");
  const [jointState, setJointState] = useState({});
  const [statusCount, setStatusCount] = useState({ ok: 0, warning: 0, error: 0 });
  const [lastError, setLastError] = useState("");

  const streamUrl = useMemo(() => buildStreamUrl(baseUrl), [baseUrl]);
  const frameSource = useMemo(() => (frameUri ? { uri: frameUri } : null), [frameUri]);
  const isConnected = connectionStatus === "connected";
  const selectedExerciseAvailable =
    exerciseLoadState === "ready" && Boolean(serverExerciseMap[selectedExercise]);

  const jointFeedback = useMemo(
    () =>
      Object.entries(jointState || {})
        .map(([key, value]) => ({
          key,
          label: value?.label || key,
          status: value?.status || "ok",
          diff: Number(value?.diff || 0),
          current: Number(value?.current || 0),
          ref: Number(value?.ref || 0),
        }))
        .sort((a, b) => b.diff - a.diff)
        .slice(0, 6),
    [jointState]
  );

  const loadServerExercises = useCallback(async () => {
    const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
    if (!normalizedBaseUrl) {
      setServerExerciseMap({});
      return;
    }

    setLoadingExercises(true);
    setExerciseLoadState("idle");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      let response = null;
      try {
        response = await fetch(`${normalizedBaseUrl}/exercises`, {
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) {
        throw new Error(`Cannot load exercises (${response.status})`);
      }

      const data = await response.json();
      const rawExercises = Array.isArray(data?.exercises)
        ? data.exercises.map((item) => String(item || "").trim()).filter(Boolean)
        : [];

      const nextMap = {};
      rawExercises.forEach((exerciseName) => {
        const key = toSupportedExerciseKey(exerciseName);
        if (key && !nextMap[key]) {
          nextMap[key] = exerciseName;
        }
      });

      setServerExerciseMap(nextMap);
      setExerciseLoadState("ready");
      setLastError("");
    } catch (error) {
      devLog("Load exercises failed:", error?.message || error);
      setServerExerciseMap({});
      setExerciseLoadState("failed");
      setLastError(
        "Cannot reach Pose server right now. You can still use local selection and tap Start Stream when server is ready."
      );
    } finally {
      setLoadingExercises(false);
    }
  }, [baseUrl]);

  useEffect(() => {
    loadServerExercises();
  }, [loadServerExercises]);

  const resetStreamState = useCallback(() => {
    setFrameUri("");
    isFrameLoadingRef.current = false;
    queuedFrameUriRef.current = "";
    setPoseDetected(false);
    setRepCount(0);
    setPhase("-");
    setJointState({});
    setStatusCount({ ok: 0, warning: 0, error: 0 });
    lastPreviewUpdateRef.current = 0;
    lastMetricUpdateRef.current = 0;
    lastMessageProcessRef.current = 0;
  }, []);

  const queueLatestFrame = useCallback((nextFrameUri) => {
    if (!nextFrameUri) return;
    if (isFrameLoadingRef.current) {
      queuedFrameUriRef.current = nextFrameUri;
      return;
    }
    isFrameLoadingRef.current = true;
    setFrameUri(nextFrameUri);
  }, []);

  const handlePreviewLoadEnd = useCallback(() => {
    const queued = queuedFrameUriRef.current;
    if (queued) {
      queuedFrameUriRef.current = "";
      setFrameUri(queued);
      return;
    }
    isFrameLoadingRef.current = false;
  }, []);

  const handlePreviewLoadError = useCallback(() => {
    isFrameLoadingRef.current = false;
    const queued = queuedFrameUriRef.current;
    if (!queued) return;
    queuedFrameUriRef.current = "";
    queueLatestFrame(queued);
  }, [queueLatestFrame]);

  const closeSocket = useCallback(() => {
    const socket = socketRef.current;
    if (!socket) return;

    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;

    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close();
    }
    socketRef.current = null;
  }, []);

  const resolveExerciseForSocket = useCallback(
    (exerciseKey) => {
      const normalized = String(exerciseKey || "").toLowerCase().trim();
      if (!normalized) return null;
      if (exerciseLoadState !== "ready") return null;
      return serverExerciseMap[normalized] || null;
    },
    [exerciseLoadState, serverExerciseMap]
  );

  const sendExerciseSelection = useCallback((exerciseKey) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    const safeExerciseKey = resolveExerciseForSocket(exerciseKey);
    const payload = { exercise: safeExerciseKey || null };
    socket.send(JSON.stringify(payload));
  }, [resolveExerciseForSocket]);

  useEffect(() => {
    const routeExercise = resolveExerciseFromRoute(
      route?.params?.exerciseKey,
      route?.params?.exerciseName
    );
    setSelectedExercise(routeExercise);
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      sendExerciseSelection(routeExercise);
    }
  }, [route?.params?.exerciseKey, route?.params?.exerciseName, sendExerciseSelection]);

  useEffect(() => {
    if (!isConnected) return;
    sendExerciseSelection(selectedExercise);
  }, [isConnected, selectedExercise, sendExerciseSelection]);

  useEffect(() => {
    if (!isConnected) return undefined;
    if (exerciseLoadState === "ready" || loadingExercises) return undefined;

    const retryTimer = setTimeout(() => {
      loadServerExercises();
    }, 2500);

    return () => clearTimeout(retryTimer);
  }, [exerciseLoadState, isConnected, loadServerExercises, loadingExercises]);

  const connectStream = useCallback(
    (exerciseKey = selectedExercise) => {
      if (!streamUrl) {
        Alert.alert("Missing URL", "Please set a valid Pose AI server URL first.");
        return;
      }
      if (!pairingCode.trim()) {
        Alert.alert("Pairing code required", "Copy the current code from the Pose server terminal and enter it here.");
        return;
      }

      const existingSocket = socketRef.current;
      if (
        existingSocket &&
        (existingSocket.readyState === WebSocket.OPEN ||
          existingSocket.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      closedByUserRef.current = false;
      resetStreamState();
      setLastError("");
      setConnectionStatus("connecting");
      connectionIdRef.current += 1;
      const activeConnectionId = connectionIdRef.current;

      try {
        const socket = new WebSocket(streamUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          if (connectionIdRef.current !== activeConnectionId) return;
          setConnectionStatus("connected");
          socket.send(JSON.stringify({ token: pairingCode.trim() }));
          loadServerExercises();
          sendExerciseSelection(exerciseKey);
        };

        socket.onmessage = (event) => {
          if (connectionIdRef.current !== activeConnectionId) return;
          try {
            const now = Date.now();

            if (now - lastMessageProcessRef.current < MESSAGE_INTERVAL_MS) {
              return;
            }
            lastMessageProcessRef.current = now;
            const data = JSON.parse(event.data);

            if (data?.error) {
              setLastError(String(data.error));
            }

            if (data?.frame) {
              if (now - lastPreviewUpdateRef.current >= PREVIEW_INTERVAL_MS) {
                queueLatestFrame(`data:image/jpeg;base64,${data.frame}`);
                lastPreviewUpdateRef.current = now;
              }
            }

            if (now - lastMetricUpdateRef.current >= METRIC_INTERVAL_MS) {
              setPoseDetected(Boolean(data?.pose_detected));
              setRepCount(Number(data?.rep_count || 0));
              setPhase(String(data?.phase || "-"));
              setJointState(data?.joints && typeof data.joints === "object" ? data.joints : {});
              setStatusCount({
                ok: Number(data?.ok || 0),
                warning: Number(data?.warning || 0),
                error: Number(data?.error || 0),
              });
              lastMetricUpdateRef.current = now;
            }
          } catch (error) {
            devLog("Parse frame message failed:", error?.message || error);
          }
        };

        socket.onerror = () => {
          if (connectionIdRef.current !== activeConnectionId) return;
          setConnectionStatus("error");
          setLastError("WebSocket error. Check server URL and network.");
        };

        socket.onclose = () => {
          if (connectionIdRef.current !== activeConnectionId) return;
          socketRef.current = null;
          if (closedByUserRef.current) {
            setConnectionStatus("idle");
            return;
          }
          setConnectionStatus("error");
          setLastError((current) => current || "Stream disconnected. Check the pairing code, server, and network.");
        };
      } catch (error) {
        devLog("Connect stream failed:", error?.message || error);
        setConnectionStatus("error");
        setLastError(error.message || "Unable to connect to stream.");
      }
    },
    [
      loadServerExercises,
      pairingCode,
      queueLatestFrame,
      resetStreamState,
      selectedExercise,
      sendExerciseSelection,
      streamUrl,
    ]
  );

  const disconnectStream = useCallback(() => {
    closedByUserRef.current = true;
    connectionIdRef.current += 1;
    closeSocket();
    setConnectionStatus("idle");
  }, [closeSocket]);

  useEffect(
    () => () => {
      closedByUserRef.current = true;
      connectionIdRef.current += 1;
      closeSocket();
    },
    [closeSocket]
  );

  const handleExercisePress = (exerciseKey) => {
    setSelectedExercise(exerciseKey);
    if (isConnected) {
      sendExerciseSelection(exerciseKey);
    }
  };

  const handleDisableReference = () => {
    if (!isConnected) return;
    sendExerciseSelection(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.headerButton}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Exercise Pose AI</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>รหัสจับคู่กล้อง</Text>
          <Text style={styles.helperText}>คัดลอกรหัสจากหน้าต่าง Pose server (รหัสเปลี่ยนเมื่อเริ่ม server ใหม่)</Text>
          <TextInput
            accessibilityLabel="Pose server pairing code"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setPairingCode}
            placeholder="กรอกรหัสจาก terminal"
            placeholderTextColor="#777"
            secureTextEntry
            style={styles.pairingInput}
            value={pairingCode}
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>เลือกท่า</Text>
          <View style={styles.exerciseRow}>
            {SUPPORTED_EXERCISES.map((exercise) => {
              const existsOnServer =
                exerciseLoadState === "ready"
                  ? Boolean(serverExerciseMap[exercise.key])
                  : true;
              return (
                <TouchableOpacity
                  key={exercise.key}
                  style={[
                    styles.exerciseChip,
                    selectedExercise === exercise.key && styles.exerciseChipActive,
                    !existsOnServer && styles.exerciseChipMissing,
                  ]}
                  onPress={() => handleExercisePress(exercise.key)}
                >
                  <Text
                    style={[
                      styles.exerciseChipText,
                      selectedExercise === exercise.key && styles.exerciseChipTextActive,
                    ]}
                  >
                    {exercise.label}
                  </Text>
                  {!existsOnServer ? <Text style={styles.missingText}>No Ref</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.row}>
            {connectionStatus === "connecting" ? (
              <TouchableOpacity style={styles.disconnectBtn} onPress={disconnectStream}>
                <Text style={styles.disconnectBtnText}>Cancel Connect</Text>
              </TouchableOpacity>
            ) : isConnected ? (
              <TouchableOpacity style={styles.disconnectBtn} onPress={disconnectStream}>
                <Text style={styles.disconnectBtnText}>Stop Stream</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.connectBtn, loadingExercises && styles.connectBtnDisabled]}
                onPress={() => connectStream(selectedExercise)}
                disabled={loadingExercises}
              >
                <Text style={styles.connectBtnText}>Start Stream</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.ghostBtn, !isConnected && styles.ghostBtnDisabled]}
              onPress={handleDisableReference}
              disabled={!isConnected}
            >
              <Text style={styles.ghostBtnText}>Skeleton Only</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.connectionText}>
            Status: {getConnectionLabel(connectionStatus)}
          </Text>
          {isConnected && exerciseLoadState !== "ready" ? (
            <Text style={styles.warningText}>
              Loading exercise references... analysis is in skeleton-only mode for now.
            </Text>
          ) : null}
          {isConnected && exerciseLoadState === "ready" && !selectedExerciseAvailable ? (
            <Text style={styles.warningText}>
              Selected exercise has no reference on server. Switched to skeleton-only mode.
            </Text>
          ) : null}
          {lastError ? <Text style={styles.errorText}>{lastError}</Text> : null}
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Live Stream</Text>
          <View style={styles.previewBox}>
            {frameUri ? (
              <Image
                source={frameSource}
                style={styles.previewImage}
                resizeMode="contain"
                fadeDuration={0}
                onLoadEnd={handlePreviewLoadEnd}
                onError={handlePreviewLoadError}
              />
            ) : (
              <Text style={styles.previewPlaceholder}>No frame yet. Tap Start Stream.</Text>
            )}
          </View>

          <View style={styles.metricRow}>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Pose</Text>
              <Text style={styles.metricValue}>{poseDetected ? "Detected" : "Not Found"}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Reps</Text>
              <Text style={styles.metricValue}>{repCount}</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricLabel}>Phase</Text>
              <Text style={styles.metricValue}>{phase}</Text>
            </View>
          </View>

          <View style={styles.scoreRow}>
            <Text style={styles.scoreTextOk}>OK {statusCount.ok}</Text>
            <Text style={styles.scoreTextWarn}>Warning {statusCount.warning}</Text>
            <Text style={styles.scoreTextError}>Error {statusCount.error}</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Joint Feedback</Text>
          {jointFeedback.length === 0 ? (
            <Text style={styles.step}>No joint data yet.</Text>
          ) : (
            jointFeedback.map((joint) => (
              <View key={joint.key} style={styles.jointRow}>
                <View>
                  <Text style={styles.jointName}>{joint.label}</Text>
                  <Text style={styles.jointMeta}>
                    current {joint.current.toFixed(1)}° | ref {joint.ref.toFixed(1)}°
                  </Text>
                </View>
                <View style={styles.jointRight}>
                  <Text style={styles.jointDiff}>{joint.diff.toFixed(1)}°</Text>
                  <Text
                    style={[
                      styles.jointStatus,
                      joint.status === "ok" && styles.statusOk,
                      joint.status === "warning" && styles.statusWarning,
                      joint.status === "error" && styles.statusError,
                    ]}
                  >
                    {joint.status}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
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
  headerButton: { color: "#FF6B1A", fontSize: 16, fontWeight: "600" },
  headerTitle: { color: "#f0ece6", fontSize: 18, fontWeight: "700" },
  headerSpacer: { width: 52 },
  panel: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 16,
    padding: 14,
  },
  panelTitle: { color: "#f0ece6", fontSize: 15, fontWeight: "700", marginBottom: 10 },
  helperText: { color: "#9a9a9a", fontSize: 12, lineHeight: 17, marginBottom: 8 },
  pairingInput: {
    backgroundColor: "#101012",
    borderColor: "#38383b",
    borderRadius: 10,
    borderWidth: 1,
    color: "#f0ece6",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  ghostBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  ghostBtnDisabled: { opacity: 0.5 },
  ghostBtnText: { color: "#bbb", fontSize: 13, fontWeight: "600" },
  exerciseRow: { flexDirection: "row", gap: 8 },
  exerciseChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#303030",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#121212",
  },
  exerciseChipActive: {
    backgroundColor: "rgba(255,107,26,0.2)",
    borderColor: "#FF6B1A",
  },
  exerciseChipMissing: {
    borderColor: "#5d3f2b",
  },
  exerciseChipText: { color: "#ddd", fontSize: 13, fontWeight: "600" },
  exerciseChipTextActive: { color: "#FF6B1A" },
  missingText: { color: "#f2b38a", fontSize: 10, marginTop: 3 },
  connectBtn: {
    flex: 1,
    backgroundColor: "#FF6B1A",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  connectBtnDisabled: { opacity: 0.6 },
  connectBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  disconnectBtn: {
    flex: 1,
    backgroundColor: "#4b1f1f",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  disconnectBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  connectionText: { color: "#bbb", fontSize: 12, marginTop: 10 },
  warningText: { color: "#f2b38a", fontSize: 12, marginTop: 4 },
  errorText: { color: "#ff8080", fontSize: 12, marginTop: 4 },
  previewBox: {
    width: "100%",
    aspectRatio: 3 / 4,
    minHeight: 420,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    alignItems: "center",
    justifyContent: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  previewPlaceholder: { color: "#666", fontSize: 13 },
  metricRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  metricCard: {
    flex: 1,
    backgroundColor: "#121212",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  metricLabel: { color: "#777", fontSize: 11 },
  metricValue: { color: "#f0ece6", fontSize: 14, fontWeight: "700", marginTop: 3 },
  scoreRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10 },
  scoreTextOk: { color: "#4ade80", fontSize: 12, fontWeight: "600" },
  scoreTextWarn: { color: "#fb923c", fontSize: 12, fontWeight: "600" },
  scoreTextError: { color: "#ef4444", fontSize: 12, fontWeight: "600" },
  step: { color: "#aaa", fontSize: 13, marginBottom: 6 },
  jointRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#262626",
  },
  jointName: { color: "#f0ece6", fontSize: 13, fontWeight: "600" },
  jointMeta: { color: "#777", fontSize: 11, marginTop: 2 },
  jointRight: { alignItems: "flex-end" },
  jointDiff: { color: "#f0ece6", fontSize: 12, fontWeight: "700" },
  jointStatus: { marginTop: 2, fontSize: 11, textTransform: "uppercase" },
  statusOk: { color: "#4ade80" },
  statusWarning: { color: "#fb923c" },
  statusError: { color: "#ef4444" },
});

export default CameraAIScreen;
