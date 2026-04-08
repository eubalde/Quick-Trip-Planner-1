import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useItinerary, Itinerary } from "@/context/ItineraryContext";

interface SavedItinerary {
  id: string;
  name: string | null;
  city: string;
  tripDays: number;
  pace: string;
  interests: string[];
  days: any[];
  isOptimized: boolean;
  createdAt: string;
}

export default function SavedScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, token } = useAuth();
  const { setCurrentItinerary } = useItinerary();

  const [itineraries, setItineraries] = useState<SavedItinerary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const renameRef = useRef<TextInput>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

  const fetchItineraries = useCallback(async () => {
    if (!user || !token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/itinerary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setItineraries((await res.json()).reverse());
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [user, token]);

  useFocusEffect(useCallback(() => { fetchItineraries(); }, [fetchItineraries]));

  const handleOpen = (item: SavedItinerary) => {
    if (renamingId) return;
    Haptics.selectionAsync();
    setCurrentItinerary({ ...item, generatedAt: item.createdAt } as Itinerary);
    router.push("/itinerary");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const { id } = deleteTarget;
    setDeleteTarget(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDeletingId(id);
    try {
      await fetch(`${apiBase}/api/itinerary/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setItineraries((prev) => prev.filter((i) => i.id !== id));
    } catch {
    } finally {
      setDeletingId(null);
    }
  };

  const startRename = (item: SavedItinerary) => {
    Haptics.selectionAsync();
    setRenamingId(item.id);
    setRenameValue(item.name ?? item.city);
    setTimeout(() => renameRef.current?.focus(), 80);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameValue("");
  };

  const saveRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (!trimmed) { cancelRename(); return; }
    setSavingRename(true);
    try {
      const res = await fetch(`${apiBase}/api/itinerary/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        setItineraries((prev) => prev.map((i) => i.id === id ? { ...i, name: trimmed } : i));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
    } finally {
      setSavingRename(false);
      setRenamingId(null);
      setRenameValue("");
    }
  };

  const s = makeStyles(colors);

  if (!user) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
          <Text style={s.title}>Saved.</Text>
        </View>
        <View style={s.guestState}>
          <Feather name="lock" size={36} color={colors.mutedForeground} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>Sign in to view saved trips</Text>
          <TouchableOpacity
            style={[s.authBtn, { backgroundColor: colors.primary, borderColor: colors.border, shadowColor: colors.border }]}
            onPress={() => router.push("/auth")}
          >
            <Text style={s.authBtnText}>SIGN IN</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* Delete confirmation modal */}
      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalBox, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Discard Postcard</Text>
            <Text style={[s.modalBody, { color: colors.mutedForeground }]}>
              Remove{deleteTarget ? ` "${deleteTarget.label}"` : ""}? This cannot be undone.
            </Text>
            <View style={s.modalActions}>
              <TouchableOpacity
                style={[s.modalBtn, { borderColor: colors.border, backgroundColor: colors.card }]}
                onPress={() => setDeleteTarget(null)}
              >
                <Text style={[s.modalBtnText, { color: colors.foreground }]}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { borderColor: colors.border, backgroundColor: colors.primary, shadowColor: colors.border }]}
                onPress={confirmDelete}
              >
                <Text style={[s.modalBtnText, { color: "#fff" }]}>DISCARD</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={[s.header, { paddingTop: topPad + 16, borderBottomColor: colors.border }]}>
        <Text style={s.title}>Saved.</Text>
        {isLoading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      <FlatList
        data={itineraries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[s.list, { paddingBottom: 100 }]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={itineraries.length > 0}
        onRefresh={fetchItineraries}
        refreshing={isLoading}
        ListEmptyComponent={
          !isLoading ? (
            <View style={s.guestState}>
              <Feather name="inbox" size={36} color={colors.mutedForeground} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>No saved trips yet</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const displayName = item.name ?? item.city;
          const isThisRenaming = renamingId === item.id;

          return (
            <TouchableOpacity
              style={[s.card, { borderColor: colors.border, shadowColor: colors.border }]}
              onPress={() => !isThisRenaming && handleOpen(item)}
              activeOpacity={isThisRenaming ? 1 : 0.85}
            >
              {/* Name row or rename input */}
              {isThisRenaming ? (
                <View style={s.renameRow}>
                  <TextInput
                    ref={renameRef}
                    style={[s.renameInput, { borderColor: colors.primary, color: colors.foreground }]}
                    value={renameValue}
                    onChangeText={setRenameValue}
                    onSubmitEditing={() => saveRename(item.id)}
                    returnKeyType="done"
                    selectTextOnFocus
                    maxLength={60}
                    placeholderTextColor={colors.mutedForeground}
                    placeholder="Trip name…"
                  />
                  <TouchableOpacity
                    style={[s.renameBtn, { backgroundColor: colors.primary, borderColor: colors.border }]}
                    onPress={() => saveRename(item.id)}
                    disabled={savingRename}
                  >
                    {savingRename
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Feather name="check" size={14} color="#fff" />}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.renameBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={cancelRename}
                    disabled={savingRename}
                  >
                    <Feather name="x" size={14} color={colors.foreground} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.nameRow}>
                  <Text style={[s.cardCity, { color: colors.foreground }]} numberOfLines={1}>
                    {displayName}.
                  </Text>
                  <TouchableOpacity style={s.editIconBtn} onPress={() => startRename(item)}>
                    <Feather name="edit-2" size={14} color={colors.teal} />
                  </TouchableOpacity>
                </View>
              )}

              {item.name && item.name !== item.city && !isThisRenaming && (
                <Text style={[s.cardSubCity, { color: colors.mutedForeground }]}>{item.city}</Text>
              )}

              <View style={s.cardBadges}>
                <View style={[s.pill, { borderColor: colors.border, backgroundColor: colors.accent }]}>
                  <Text style={[s.pillText, { color: colors.foreground }]}>
                    {item.tripDays} {item.tripDays === 1 ? "DAY" : "DAYS"}
                  </Text>
                </View>
                <View style={[s.pill, { borderColor: colors.border, backgroundColor: "#FFFBEB" }]}>
                  <Text style={[s.pillText, { color: colors.foreground }]}>{item.pace.toUpperCase()}</Text>
                </View>
                {item.isOptimized && (
                  <View style={[s.pill, { borderColor: colors.border, backgroundColor: colors.teal }]}>
                    <Text style={[s.pillText, { color: "#fff" }]}>OPTIMISED</Text>
                  </View>
                )}
              </View>

              <View style={[s.cardFooter, { borderTopColor: colors.border }]}>
                <Text style={[s.mono, { color: colors.mutedForeground, fontSize: 9 }]}>
                  {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase()}
                </Text>
                <TouchableOpacity
                  onPress={() => setDeleteTarget({ id: item.id, label: displayName })}
                  disabled={deletingId === item.id || isThisRenaming}
                  style={s.deleteBtn}
                >
                  {deletingId === item.id
                    ? <ActivityIndicator size="small" color={colors.primary} />
                    : <Feather name="trash-2" size={14} color={colors.primary} />}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 16,
      borderBottomWidth: 2,
      marginBottom: 4,
    },
    title: { fontFamily: "DMSerifDisplay_400Italic", fontSize: 36, color: "#451A03" },
    list: { paddingHorizontal: 20, paddingTop: 16 },
    card: {
      borderWidth: 2,
      borderRadius: 4,
      backgroundColor: "#FFFBEB",
      padding: 16,
      marginBottom: 14,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },

    nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
    cardCity: { fontFamily: "DMSerifDisplay_400Italic", fontSize: 28, flex: 1 },
    editIconBtn: { padding: 4 },
    cardSubCity: { fontFamily: "SpaceMono_400Regular", fontSize: 10, marginBottom: 6, letterSpacing: 0.5 },

    renameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    renameInput: {
      flex: 1,
      fontFamily: "SpaceMono_400Regular",
      fontSize: 14,
      borderWidth: 2,
      borderRadius: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: "#fff",
    },
    renameBtn: {
      width: 34,
      height: 34,
      borderWidth: 2,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
    },

    cardBadges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
    pill: { borderWidth: 2, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    pillText: { fontFamily: "SpaceMono_700Bold", fontSize: 9 },
    cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 2, paddingTop: 10 },
    deleteBtn: { padding: 4 },
    guestState: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80, paddingHorizontal: 40, gap: 12 },
    emptyTitle: { fontFamily: "DMSerifDisplay_400Regular", fontSize: 22, textAlign: "center" },
    mono: { fontFamily: "SpaceMono_400Regular" },
    authBtn: {
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderWidth: 2,
      borderRadius: 4,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
    authBtnText: { fontFamily: "SpaceMono_700Bold", fontSize: 12, color: "#fff", letterSpacing: 2 },

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
