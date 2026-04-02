import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await logout();
        },
      },
    ]);
  };

  const styles = createStyles(colors);

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 16 }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
        </View>
        <View style={styles.guestState}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.secondary }]}>
            <Feather name="user" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.guestTitle, { color: colors.foreground }]}>Not signed in</Text>
          <Text style={[styles.guestText, { color: colors.mutedForeground }]}>
            Sign in to save itineraries and access them anytime
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/auth")}
          >
            <Text style={styles.primaryBtnText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
            onPress={() => router.push("/auth?mode=register")}
          >
            <Text style={[styles.secondaryBtnText, { color: colors.foreground }]}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 100 : 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: topPad + 16 }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Profile</Text>
        </View>

        <View style={styles.profileSection}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={[styles.userName, { color: colors.foreground }]}>{user.name}</Text>
          <Text style={[styles.userEmail, { color: colors.mutedForeground }]}>{user.email}</Text>
          <Text style={[styles.memberSince, { color: colors.mutedForeground }]}>
            Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </Text>
        </View>

        <View style={styles.settingsSection}>
          <View style={[styles.settingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.settingRow, { borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
              <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
                <Feather name="mail" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: colors.mutedForeground }]}>Email</Text>
                <Text style={[styles.settingValue, { color: colors.foreground }]}>{user.email}</Text>
              </View>
            </View>
            <View style={styles.settingRow}>
              <View style={[styles.settingIcon, { backgroundColor: colors.accent }]}>
                <Feather name="user" size={16} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: colors.mutedForeground }]}>Name</Text>
                <Text style={[styles.settingValue, { color: colors.foreground }]}>{user.name}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <TouchableOpacity
            style={[styles.logoutBtn, { borderColor: colors.destructive }]}
            onPress={handleLogout}
          >
            <Feather name="log-out" size={16} color={colors.destructive} style={{ marginRight: 8 }} />
            <Text style={[styles.logoutText, { color: colors.destructive }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    title: { fontSize: 26, fontFamily: "Inter_700Bold" },
    profileSection: {
      alignItems: "center",
      paddingVertical: 32,
      paddingHorizontal: 20,
    },
    avatarCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    avatarText: { color: "#fff", fontSize: 28, fontFamily: "Inter_700Bold" },
    userName: { fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 4 },
    userEmail: { fontSize: 15, fontFamily: "Inter_400Regular", marginBottom: 4 },
    memberSince: { fontSize: 13, fontFamily: "Inter_400Regular" },
    settingsSection: { paddingHorizontal: 20, marginBottom: 16 },
    settingCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      gap: 12,
    },
    settingIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
    },
    settingLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 2 },
    settingValue: { fontSize: 15, fontFamily: "Inter_500Medium" },
    guestState: { alignItems: "center", paddingHorizontal: 40, paddingTop: 40 },
    guestTitle: { fontSize: 22, fontFamily: "Inter_700Bold", marginTop: 16, marginBottom: 8 },
    guestText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20, marginBottom: 32 },
    primaryBtn: {
      width: "100%",
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
      marginBottom: 12,
    },
    primaryBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
    secondaryBtn: {
      width: "100%",
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      alignItems: "center",
    },
    secondaryBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
    logoutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
    },
    logoutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  });
}
