import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { signUp } from "../firebase/auth";

const RegisterScreen = ({ navigation }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert("กรุณากรอกชื่อ อีเมล และรหัสผ่าน");
      return;
    }

    if (password.length < 6) {
      Alert.alert("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setLoading(true);
    try {
      const result = await signUp(email.trim(), password, name.trim(), age, gender);
      Alert.alert("สมัครสมาชิกสำเร็จ", "สามารถเข้าสู่ระบบได้ทันที");
      if (!result?.session) navigation.goBack();
    } catch (error) {
      Alert.alert("สมัครสมาชิกไม่สำเร็จ", error.message || "กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>กลับ</Text>
          </TouchableOpacity>

          <Text style={styles.logoText}>FITAI</Text>
          <Text style={styles.title}>สมัครสมาชิก</Text>
          <Text style={styles.subtitle}>
            สร้างบัญชีเพื่อบันทึกข้อมูลสุขภาพ การนอน อาหาร และเป้าหมายของคุณ
          </Text>

          <Text style={styles.inputLabel}>ชื่อ</Text>
          <TextInput
            style={styles.input}
            placeholder="ชื่อ - นามสกุล"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.inputLabel}>อีเมล</Text>
          <TextInput
            style={styles.input}
            placeholder="name@email.com"
            placeholderTextColor="#666"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.inputLabel}>รหัสผ่าน</Text>
          <TextInput
            style={styles.input}
            placeholder="อย่างน้อย 6 ตัวอักษร"
            placeholderTextColor="#666"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text style={styles.inputLabel}>อายุ</Text>
          <TextInput
            style={styles.input}
            placeholder="ไม่บังคับ"
            placeholderTextColor="#666"
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
          />

          <Text style={styles.inputLabel}>เพศ</Text>
          <View style={styles.genderRow}>
            {["ชาย", "หญิง", "ไม่ระบุ"].map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.genderChip, gender === option && styles.genderChipActive]}
                onPress={() => setGender(option)}
              >
                <Text
                  style={[
                    styles.genderChipText,
                    gender === option && styles.genderChipTextActive,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.btnPrimary} onPress={handleRegister} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>สร้างบัญชี</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginText}>มีบัญชีอยู่แล้ว? </Text>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.loginLink}>เข้าสู่ระบบ</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },
  scroll: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 20, paddingBottom: 32 },
  backBtn: { marginBottom: 20 },
  backBtnText: { fontSize: 16, color: "#FF6B1A", fontWeight: "600" },
  logoText: { fontSize: 28, fontWeight: "800", color: "#FF6B1A", letterSpacing: 4 },
  title: { fontSize: 24, fontWeight: "700", color: "#f0ece6", marginTop: 8 },
  subtitle: { fontSize: 13, color: "#888", marginTop: 8, marginBottom: 24, lineHeight: 20 },
  inputLabel: { fontSize: 12, color: "#888", marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: "#1e1e1e",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: "#f0ece6",
    fontSize: 14,
  },
  genderRow: { flexDirection: "row", gap: 10 },
  genderChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
  },
  genderChipActive: { backgroundColor: "#FF6B1A", borderColor: "#FF6B1A" },
  genderChipText: { fontSize: 13, color: "#999" },
  genderChipTextActive: { color: "#fff", fontWeight: "600" },
  btnPrimary: {
    backgroundColor: "#FF6B1A",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 20,
  },
  btnPrimaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  loginRow: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  loginText: { color: "#888", fontSize: 13 },
  loginLink: { color: "#FF6B1A", fontSize: 13, fontWeight: "600" },
});

export default RegisterScreen;
