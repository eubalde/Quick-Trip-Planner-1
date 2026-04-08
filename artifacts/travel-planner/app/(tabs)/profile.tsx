import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
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
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const confirmLogout = async () => {
    setShowLogoutModal(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await logout();
  };

  const s = makeStyles(colors);

  if (!user) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
          <Text style={s.title}>Profile.</Text>
        </View>
        <View style={s.guestState}>
          <View style={[s.avatarBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Feather name="user" size={40} color={colors.mutedForeground} />
          </View>
          <Text style={[s.guestHeadline, { color: colors.foreground }]}>Anonymous Explorer</Text>
          <TouchableOpacity
            style={[s.primaryBtn, { backgroundColor: colors.primary, borderColor: colors.border, shadowColor: colors.border }]}
            onPress={() => router.push("/auth")}
          >
            <Text style={s.primaryBtnText}>SIGN IN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.secondaryBtn, { borderColor: colors.border, shadowColor: colors.border }]}
            onPress={() => router.push("/auth?mode=register")}
          >
            <Text style={[s.secondaryBtnText, { color: colors.foreground }]}>CREATE ACCOUNT</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const initials = user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Logout confirmation modal — Alert.alert() is blocked inside iframes */}
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>End Session</Text>
            <Text style={[s.modalBody, { color: colors.mutedForeground }]}>
              Sign out of Voyager? Your saved trips will still be here when you return.
            </Text>
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={[s.modalBtnText, { color: colors.foreground }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { borderColor: colors.border, backgroundColor: colors.primary, shadowColor: colors.border }]}
                onPress={confirmLogout}
              >
                <Text style={[s.modalBtnText, { color: "#fff" }]}>SIGN OUT</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === "web" ? 100 : 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[s.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
          <Text style={s.title}>Profile.</Text>
        </View>

        <View style={s.profileHero}>
          <View style={[s.avatarBox, { backgroundColor: colors.primary, borderColor: colors.border }]}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={[s.heroName, { color: colors.foreground }]}>{user.name}.</Text>
          <Text style={[s.mono, { color: colors.mutedForeground, fontSize: 10 }]}>{user.email}</Text>
          <Text style={[s.mono, { color: colors.mutedForeground, fontSize: 9, marginTop: 4 }]}>
            EXPLORER SINCE {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase()}
          </Text>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          <View style={[s.infoCard, { borderColor: colors.border, shadowColor: colors.border }]}>
            <View style={[s.infoRow, { borderBottomColor: colors.border }]}>
              <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>EMAIL</Text>
              <Text style={[s.infoVal, { color: colors.foreground }]}>{user.email}</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>NAME</Text>
              <Text style={[s.infoVal, { color: colors.foreground }]}>{user.name}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[s.logoutBtn, { borderColor: colors.primary, shadowColor: colors.border }]}
            onPress={() => {
              Haptics.selectionAsync();
              setShowLogoutModal(true);
            }}
          >
            <Feather name="log-out" size={14} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={[s.logoutText, { color: colors.primary }]}>END SESSION</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 2,
      marginBottom: 0,
    },
    title: { fontFamily: "DMSerifDisplay_400Italic", fontSize: 36, color: "#451A03" },
    profileHero: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 20 },
    avatarBox: {
      width: 80,
      height: 80,
      borderWidth: 2,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    avatarText: { fontFamily: "DMSerifDisplay_400Regular", fontSize: 32, color: "#fff" },
    heroName: { fontFamily: "DMSerifDisplay_400Italic", fontSize: 32, marginBottom: 4 },
    mono: { fontFamily: "SpaceMono_400Regular" },
    infoCard: {
      borderWidth: 2,
      borderRadius: 4,
      padding: 16,
      backgroundColor: "#FFFBEB",
      marginBottom: 16,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
    infoRow: {
      paddingVertical: 12,
      borderBottomWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    infoLabel: { fontFamily: "SpaceMono_700Bold", fontSize: 9, letterSpacing: 1 },
    infoVal: { fontFamily: "Inter_500Medium", fontSize: 14 },
    logoutBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 14,
      borderWidth: 2,
      borderRadius: 4,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    logoutText: { fontFamily: "SpaceMono_700Bold", fontSize: 11, letterSpacing: 2 },
    guestState: { flex: 1, alignItems: "center", paddingHorizontal: 40, paddingTop: 40, gap: 12 },
    guestHeadline: { fontFamily: "DMSerifDisplay_400Italic", fontSize: 24 },
    primaryBtn: {
      width: "100%",
      paddingVertical: 16,
      alignItems: "center",
      borderWidth: 2,
      borderRadius: 4,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
      marginTop: 8,
    },
    primaryBtnText: { fontFamily: "SpaceMono_700Bold", fontSize: 12, color: "#fff", letterSpacing: 2 },
    secondaryBtn: {
      width: "100%",
      paddingVertical: 16,
      alignItems: "center",
      borderWidth: 2,
      borderRadius: 4,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
    secondaryBtnText: { fontFamily: "SpaceMono_700Bold", fontSize: 12, letterSpacing: 2 },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    modalBox: {
      width: "100%",
      maxWidth: 360,
      borderWidth: 2,
      borderRadius: 4,
      padding: 24,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 8,
    },
    modalTitle: { fontFamily: "DMSerifDisplay_400Italic", fontSize: 24, marginBottom: 8 },
    modalBody: { fontFamily: "SpaceMono_400Regular", fontSize: 11, lineHeight: 18, marginBottom: 20 },
    modalActions: { flexDirection: "row", gap: 10 },
    modalBtn: {
      flex: 1,
      paddingVertical: 12,
      borderWidth: 2,
      borderRadius: 4,
      alignItems: "center",
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    modalBtnText: { fontFamily: "SpaceMono_700Bold", fontSize: 11, letterSpacing: 1 },
  });
}
