import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { trackCrash } from "../services/telemetry";

export default class AppErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    void trackCrash(error, "react_boundary");
    if (__DEV__) console.error("FITAI render error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>ขออภัย แอปเกิดข้อผิดพลาด</Text>
        <Text style={styles.message}>ลองกลับไปเริ่มต้นหน้าจออีกครั้ง</Text>
        <Pressable style={styles.button} onPress={() => this.setState({ failed: false })}>
          <Text style={styles.buttonText}>ลองอีกครั้ง</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#0D0D0F" },
  title: { color: "#F4F4F5", fontSize: 19, fontWeight: "700", textAlign: "center" },
  message: { color: "#8B8B91", fontSize: 14, marginTop: 10, textAlign: "center" },
  button: { backgroundColor: "#FF6B1A", borderRadius: 12, marginTop: 22, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText: { color: "#fff", fontWeight: "700" },
});
