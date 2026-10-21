import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../firebase/config";
import { addSleepLog, getSleepLogs } from "../firebase/db";

const DAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const SleepTrackerScreen = ({ navigation }) => {
  const [uid, setUid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [logs, setLogs] = useState([]);
  const [bedTime, setBedTime] = useState("22:30");
  const [wakeTime, setWakeTime] = useState("06:30");

  useEffect(() => {
    auth.getCurrentUser().then((user) => setUid(user?.uid || user?.id || null));
  }, []);

  useEffect(() => {
    if (!uid) return;
    loadSleep(uid);
  }, [uid]);

  const loadSleep = async (nextUid = uid) => {
    if (!nextUid) return;
    setLoading(true);
    try {
      const data = await getSleepLogs(nextUid);
      setLogs(data);
    } catch (error) {
      Alert.alert("เกิดข้อผิดพลาด", error.message);
    } finally {
      setLoading(false);
      setInitialLoadDone(true);
    }
  };

  const calcHours = (bed, wake) => {
    const [bh, bm] = bed.split(":").map(Number);
    const [wh, wm] = wake.split(":").map(Number);
    let minutes = wh * 60 + wm - (bh * 60 + bm);
    if (minutes < 0) minutes += 24 * 60;
    return Math.round((minutes / 60) * 10) / 10;
  };

  const adjustTime = (time, setter, deltaMinutes) => {
    const [hour, minute] = time.split(":").map(Number);
    const total = ((hour * 60 + minute + deltaMinutes) + 24 * 60) % (24 * 60);
    const nextHour = String(Math.floor(total / 60)).padStart(2, "0");
    const nextMinute = String(total % 60).padStart(2, "0");
    setter(`${nextHour}:${nextMinute}`);
  };

  const handleLogSleep = async () => {
    if (!uid) {
      Alert.alert("ยังไม่พบบัญชีผู้ใช้");
      return;
    }

    setLoading(true);
    try {
      const hours = calcHours(bedTime, wakeTime);
      const quality = Math.min(Math.round((hours / 8) * 100), 100);
      await addSleepLog(uid, {
        bedTime,
        wakeTime,
        hours,
        quality,
        deep: Math.round(hours * 0.22 * 10) / 10,
        light: Math.round(hours * 0.45 * 10) / 10,
        rem: Math.round(hours * 0.33 * 10) / 10,
      });
      await loadSleep(uid);
      Alert.alert("บันทึกแล้ว", `นอน ${bedTime} - ตื่น ${wakeTime}\nรวม ${hours} ชั่วโมง`);
    } catch (error) {
      Alert.alert("เกิดข้อผิดพลาด", error.message);
    } finally {
      setLoading(false);
    }
  };

  const latest = logs[0];
  const lastHours = latest?.hours || 0;
  const lastQuality = latest?.quality || 0;
  const weeklyAvg = logs.length
    ? Math.round((logs.reduce((sum, log) => sum + (log.hours || 0), 0) / logs.length) * 10) / 10
    : 0;
  const qualityColor = lastQuality >= 80 ? "#4ade80" : lastQuality >= 60 ? "#facc15" : "#f87171";
  const qualityLabel = lastQuality >= 80 ? "ดีมาก" : lastQuality >= 60 ? "พอใช้" : "ควรพักเพิ่ม";
  const weekData = Array(7).fill(0);
  const weekDays = Array(7).fill("-");
  logs.slice(0, 7).reverse().forEach((log, index) => {
    weekData[index] = log.hours || 0;
    weekDays[index] = DAY_LABELS[new Date(log.date || log.created_at || Date.now()).getDay()];
  });
  const maxBar = Math.max(...weekData, 1);

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>กลับ</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ติดตามการนอน</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.mainCard}>
          <Text style={styles.cardLabel}>คืนล่าสุด</Text>
          {lastHours > 0 ? (
            <>
              <View style={styles.sleepRow}>
                <Text style={styles.sleepHours}>{lastHours}</Text>
                <Text style={styles.sleepUnit}>ชั่วโมง</Text>
                <View style={[styles.qualityBadge, { backgroundColor: `${qualityColor}20` }]}>
                  <Text style={[styles.qualityText, { color: qualityColor }]}>{qualityLabel}</Text>
                </View>
              </View>
              <View style={styles.qualityBarBg}>
                <View style={[styles.qualityBarFill, { width: `${lastQuality}%`, backgroundColor: qualityColor }]} />
              </View>
              <Text style={styles.qualityPct}>คุณภาพการนอน {lastQuality}%</Text>
            </>
          ) : (
            <Text style={styles.noDataText}>ยังไม่มีข้อมูลการนอน ลองบันทึกข้อมูลด้านล่างก่อน</Text>
          )}
        </View>

        {latest ? (
          <View style={styles.stagesCard}>
            <Text style={styles.sectionTitle}>ช่วงการนอน</Text>
            {[
              { label: "Deep Sleep", value: latest.deep || 0, color: "#6366f1" },
              { label: "Light Sleep", value: latest.light || 0, color: "#60a5fa" },
              { label: "REM", value: latest.rem || 0, color: "#a78bfa" },
            ].map((stage) => (
              <View key={stage.label} style={styles.stageRow}>
                <View style={[styles.stageDot, { backgroundColor: stage.color }]} />
                <Text style={styles.stageLabel}>{stage.label}</Text>
                <View style={styles.stageBarBg}>
                  <View
                    style={[
                      styles.stageBarFill,
                      {
                        width: lastHours > 0 ? `${(stage.value / lastHours) * 100}%` : "0%",
                        backgroundColor: stage.color,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.stageVal}>{stage.value}h</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>ย้อนหลัง 7 วัน</Text>
            <Text style={styles.avgText}>เฉลี่ย {weeklyAvg} ชม.</Text>
          </View>
          <Svg width="100%" height={100} viewBox="0 0 300 100">
            {weekData.map((value, index) => {
              const barHeight = (value / maxBar) * 70;
              const x = index * 42 + 8;
              return (
                <Svg key={index}>
                  <Rect
                    x={x}
                    y={90 - barHeight}
                    width={28}
                    height={Math.max(barHeight, 2)}
                    rx={6}
                    fill={index === weekData.length - 1 ? "#FF6B1A" : "#2a2a2a"}
                  />
                  <SvgText x={x + 14} y={98} textAnchor="middle" fill="#888" fontSize={9}>
                    {weekDays[index]}
                  </SvgText>
                </Svg>
              );
            })}
          </Svg>
        </View>

        <View style={styles.logCard}>
          <Text style={styles.sectionTitle}>บันทึกการนอน</Text>
          <View style={styles.timeRow}>
            <TimeBox
              label="เวลานอน"
              value={bedTime}
              onIncrease={() => adjustTime(bedTime, setBedTime, 30)}
              onDecrease={() => adjustTime(bedTime, setBedTime, -30)}
            />
            <View style={styles.timeDivider}>
              <Text style={styles.timeDividerText}>→</Text>
            </View>
            <TimeBox
              label="เวลาตื่น"
              value={wakeTime}
              onIncrease={() => adjustTime(wakeTime, setWakeTime, 30)}
              onDecrease={() => adjustTime(wakeTime, setWakeTime, -30)}
            />
          </View>
          <Text style={styles.durationPreview}>รวมเวลา {calcHours(bedTime, wakeTime)} ชั่วโมง</Text>
          <TouchableOpacity style={styles.logBtn} onPress={handleLogSleep} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.logBtnText}>บันทึกการนอน</Text>}
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const TimeBox = ({ label, value, onIncrease, onDecrease }) => (
  <View style={styles.timeBox}>
    <Text style={styles.timeLabel}>{label}</Text>
    <Text style={styles.timeVal}>{value}</Text>
    <View style={styles.timeControls}>
      <TouchableOpacity style={styles.timeBtn} onPress={onDecrease}>
        <Text style={styles.timeBtnText}>-</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.timeBtn} onPress={onIncrease}>
        <Text style={styles.timeBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12 },
  backBtn: { fontSize: 16, color: "#FF6B1A", fontWeight: "600" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#f0ece6" },
  mainCard: { margin: 16, backgroundColor: "#1a1a1a", borderRadius: 16, padding: 20 },
  cardLabel: { fontSize: 12, color: "#888", marginBottom: 8 },
  sleepRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 12 },
  sleepHours: { fontSize: 52, fontWeight: "800", color: "#f0ece6" },
  sleepUnit: { fontSize: 18, color: "#888" },
  qualityBadge: { marginLeft: "auto", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  qualityText: { fontSize: 12, fontWeight: "700" },
  qualityBarBg: { height: 6, backgroundColor: "#1e1e1e", borderRadius: 3, overflow: "hidden" },
  qualityBarFill: { height: "100%", borderRadius: 3 },
  qualityPct: { fontSize: 11, color: "#888", marginTop: 6 },
  noDataText: { fontSize: 13, color: "#666", paddingVertical: 8 },
  stagesCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: "#1a1a1a", borderRadius: 16, padding: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#f0ece6", marginBottom: 12 },
  stageRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  stageDot: { width: 10, height: 10, borderRadius: 5 },
  stageLabel: { fontSize: 13, color: "#888", width: 80 },
  stageBarBg: { flex: 1, height: 6, backgroundColor: "#1e1e1e", borderRadius: 3, overflow: "hidden" },
  stageBarFill: { height: "100%", borderRadius: 3 },
  stageVal: { fontSize: 12, color: "#f0ece6", width: 34, textAlign: "right" },
  chartCard: { marginHorizontal: 16, marginBottom: 12, backgroundColor: "#1a1a1a", borderRadius: 16, padding: 16 },
  chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  avgText: { fontSize: 12, color: "#FF6B1A" },
  logCard: { marginHorizontal: 16, backgroundColor: "#1a1a1a", borderRadius: 16, padding: 16 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  timeBox: { flex: 1, backgroundColor: "#1e1e1e", borderRadius: 12, padding: 12, alignItems: "center" },
  timeLabel: { fontSize: 11, color: "#888", marginBottom: 4 },
  timeVal: { fontSize: 20, fontWeight: "700", color: "#f0ece6", marginBottom: 8 },
  timeControls: { flexDirection: "row", gap: 8 },
  timeBtn: { backgroundColor: "#2a2a2a", borderRadius: 8, width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  timeBtnText: { fontSize: 18, color: "#f0ece6", fontWeight: "700" },
  timeDivider: { alignItems: "center" },
  timeDividerText: { fontSize: 18, color: "#444" },
  durationPreview: { fontSize: 13, color: "#FF6B1A", textAlign: "center", marginBottom: 12 },
  logBtn: { backgroundColor: "#FF6B1A", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  logBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

export default SleepTrackerScreen;
