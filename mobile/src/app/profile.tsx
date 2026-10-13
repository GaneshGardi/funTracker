
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";

export default function ProfileScreen() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      router.replace("/login");
    } catch (error) {
      console.error("Logout error:", error);

      Alert.alert(
        "Could not log out",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>👤</Text>
      </View>

      <Text style={styles.title}>Profile</Text>

      <Text style={styles.subtitle}>
        Manage your account and settings.
      </Text>

      <View style={styles.accountCard}>
        <Text style={styles.accountTitle}>Your account</Text>
        <Text style={styles.accountDescription}>
          You are signed in to FunTracker.
        </Text>
      </View>

      <Pressable
        style={[
          styles.logoutButton,
          loggingOut && styles.disabledButton,
        ]}
        onPress={() => void handleLogout()}
        disabled={loggingOut}
        accessibilityRole="button"
        accessibilityLabel="Log out of FunTracker"
      >
        {loggingOut ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.logoutButtonText}>Log out</Text>
        )}
      </Pressable>

      <Text style={styles.footer}>fun tracker · your calorie tracking app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DBEAFE",
    marginBottom: 18,
  },
  avatarText: {
    fontSize: 34,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111827",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
  },
  accountCard: {
    width: "100%",
    padding: 18,
    marginTop: 32,
    marginBottom: 22,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  accountTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  accountDescription: {
    marginTop: 6,
    fontSize: 14,
    color: "#6B7280",
  },
  logoutButton: {
    width: "100%",
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
    borderRadius: 14,
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.65,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    color: "#9CA3AF",
    fontSize: 12,
  },
});
