import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  TextInput,
  Animated,
  ScrollView,
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
  days: { day: number; activities: { id: string }[] }[];
  isOptimized: boolean;
  createdAt: string;
  updatedAt: string;
}

const PACE_COLORS: Record<string, string> = {
  relaxed: "#D1FAE5",
  standard: "#FEF3C7",
  packed: "#FEE2E2",
};

const PACE_TEXT_COLORS: Record<string, string> = {
  relaxed: "#065F46",
  standard: "#92400E",
  packed: "#991B1B",
};

export default function ItineraryListScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, token } = useAuth();
  const { currentItinerary, setCurrentItinerary } = useItinerary();

  const [saved, setSaved] = useState<SavedItinerary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const renameInputRef = useRef<TextInput>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

  const fetchSaved = useCallback(async () => {
    if (!user || !token) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/itinerary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setSaved((await res.json()).reverse());
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [user, token]);

  useFocusEffect(useCallback(() => { fetchSaved(); }, [fetchSaved]));

  const handleOpen = (item: SavedItinerary) => {
    Haptics.selectionAsync();
    setCurrentItinerary({ ...item, generatedAt: item.createdAt } as Itinerary);
    router.push("/itinerary");
  };

  const handleOpenCurrent = () => {
    Haptics.selectionAsync();
    router.push("/itinerary");
  };

  const handleDelete = (id: string, displayName: string) => {
    Alert.alert(
      "Discard Postcard",
      `Remove "${displayName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setDeletingId(id);
            try {
              await fetch(`${apiBase}/api/itinerary/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              setSaved((prev) => prev.filter((i) => i.id !== id));
            } catch {
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const startRename = (item: SavedItinerary) => {
    Haptics.selectionAsync();
    setRenamingId(item.id);
    setRenameValue(item.name ?? item.city);
    setTimeout(() => renameInputRef.current?.focus(), 100);
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
        setSaved((prev) =>
          prev.map((i) => (i.id === id ? { ...i, name: trimmed } : i))
        );
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
    } finally {
      setSavingRename(false);
      setRenamingId(null);
      setRenameValue("");
    }
  };

  const totalStops = (item: { days: { activities: { id: string }[] }[] }) =>
    item.days.reduce((s, d) => s + d.activities.length, 0);

  const s = makeStyles(colors, topPad);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Text style={[s.title, { color: colors.foreground }]}>Itinerary.</Text>
        {isLoading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.scroll, { paddingBottom: Platform.OS === "web" ? 120 : 110 }]}
      >
        {/* ── CURRENT SESSION ─────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionLabelRow}>
            <View style={[s.sectionDot, { backgroundColor: colors.teal }]} />
            <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>CURRENT SESSION</Text>
          </View>

          {currentItinerary ? (
            <TouchableOpacity
              style={[s.currentCard, { borderColor: colors.border, shadowColor: colors.border }]}
              onPress={handleOpenCurrent}
              activeOpacity={0.85}
            >
              <View style={s.currentCardTop}>
                <View style={s.currentMeta}>
                  <View style={[s.liveDot]} />
                  <Text style={[s.liveLabel, { color: colors.teal }]}>ACTIVE</Text>
                </View>
                <View style={[s.currentStamp, { backgroundColor: colors.teal, borderColor: colors.border }]}>
                  <Text style={s.stampText}>{currentItinerary.city.slice(0, 3).toUpperCase()}</Text>
                </View>
              </View>

              <Text style={[s.currentCity, { color: colors.foreground }]}>{currentItinerary.city}.</Text>

              <View style={s.currentPills}>
                <View style={[s.pill, { borderColor: colors.border, backgroundColor: colors.accent }]}>
                  <Text style={[s.pillText, { color: colors.foreground }]}>
                    {currentItinerary.tripDays} {currentItinerary.tripDays === 1 ? "DAY" : "DAYS"}
                  </Text>
                </View>
                <View style={[s.pill, { borderColor: colors.border, backgroundColor: PACE_COLORS[currentItinerary.pace] ?? "#FEF3C7" }]}>
                  <Text style={[s.pillText, { color: PACE_TEXT_COLORS[currentItinerary.pace] ?? "#92400E" }]}>
                    {currentItinerary.pace.toUpperCase()}
                  </Text>
                </View>
                <View style={[s.pill, { borderColor: colors.border, backgroundColor: "#FFFBEB" }]}>
                  <Text style={[s.pillText, { color: colors.foreground }]}>
                    {totalStops(currentItinerary)} STOPS
                  </Text>
                </View>
              </View>

              <View style={[s.currentFooter, { borderTopColor: colors.border }]}>
                <Text style={[s.footerMono, { color: colors.mutedForeground }]}>
                  {currentItinerary.interests?.map((i) => i.toUpperCase()).join(" · ")}
                </Text>
                <View style={[s.openBadge, { backgroundColor: colors.foreground }]}>
                  <Text style={[s.openBadgeText, { color: colors.accent }]}>OPEN →</Text>
                </View>
              </View>
            </TouchableOpacity>
          ) : (
            <View style={[s.emptyCard, { borderColor: colors.border }]}>
              <Feather name="map" size={28} color={colors.mutedForeground} />
              <Text style={[s.emptyCardText, { color: colors.mutedForeground }]}>
                No active itinerary — go to Plan to generate one.
              </Text>
              <TouchableOpacity
                style={[s.planBtn, { backgroundColor: colors.primary, borderColor: colors.border, shadowColor: colors.border }]}
                onPress={() => router.push("/(tabs)/")}
              >
                <Text style={s.planBtnText}>GO TO PLAN</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── SAVED POSTCARDS ─────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.sectionLabelRow}>
            <View style={[s.sectionDot, { backgroundColor: colors.primary }]} />
            <Text style={[s.sectionLabel, { color: colors.mutedForeground }]}>SAVED POSTCARDS</Text>
          </View>

          {!user ? (
            <View style={[s.emptyCard, { borderColor: colors.border }]}>
              <Feather name="lock" size={28} color={colors.mutedForeground} />
              <Text style={[s.emptyCardText, { color: colors.mutedForeground }]}>
                Sign in to save and manage your itineraries.
              </Text>
              <TouchableOpacity
                style={[s.planBtn, { backgroundColor: colors.primary, borderColor: colors.border, shadowColor: colors.border }]}
                onPress={() => router.push("/auth")}
              >
                <Text style={s.planBtnText}>SIGN IN</Text>
              </TouchableOpacity>
            </View>
          ) : saved.length === 0 && !isLoading ? (
            <View style={[s.emptyCard, { borderColor: colors.border }]}>
              <Feather name="inbox" size={28} color={colors.mutedForeground} />
              <Text style={[s.emptyCardText, { color: colors.mutedForeground }]}>
                No saved trips yet. Generate an itinerary and hit Save.
              </Text>
            </View>
          ) : (
            saved.map((item) => {
              const displayName = item.name ?? item.city;
              const isRenaming = renamingId === item.id;
              const isDeleting = deletingId === item.id;
              const stops = totalStops(item);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.card, { borderColor: colors.border, shadowColor: colors.border }]}
                  onPress={() => !isRenaming && handleOpen(item)}
                  activeOpacity={isRenaming ? 1 : 0.85}
                >
                  {/* Stamp */}
                  <View style={[s.stamp, { backgroundColor: colors.primary, borderColor: colors.border }]}>
                    <Text style={s.stampText}>{item.city.slice(0, 3).toUpperCase()}</Text>
                    <Text style={s.stampYear}>{new Date(item.createdAt).getFullYear()}</Text>
                  </View>

                  {/* Name / rename input */}
                  {isRenaming ? (
                    <View style={s.renameRow}>
                      <TextInput
                        ref={renameInputRef}
                        style={[s.renameInput, { borderColor: colors.primary, color: colors.foreground }]}
                        value={renameValue}
                        onChangeText={setRenameValue}
                        onSubmitEditing={() => saveRename(item.id)}
                        returnKeyType="done"
                        selectTextOnFocus
                        maxLength={60}
                        placeholderTextColor={colors.mutedForeground}
                      />
                      <TouchableOpacity
                        style={[s.renameActionBtn, { backgroundColor: colors.primary, borderColor: colors.border }]}
                        onPress={() => saveRename(item.id)}
                        disabled={savingRename}
                      >
                        {savingRename ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Feather name="check" size={14} color="#fff" />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[s.renameActionBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={cancelRename}
                        disabled={savingRename}
                      >
                        <Feather name="x" size={14} color={colors.foreground} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={[s.cardName, { color: colors.foreground }]} numberOfLines={1}>
                      {displayName}.
                    </Text>
                  )}

                  {/* Sub-city label if renamed */}
                  {item.name && item.name !== item.city && !isRenaming && (
                    <Text style={[s.cardSubCity, { color: colors.mutedForeground }]}>{item.city}</Text>
                  )}

                  {/* Badges */}
                  <View style={s.badges}>
                    <View style={[s.pill, { borderColor: colors.border, backgroundColor: colors.accent }]}>
                      <Text style={[s.pillText, { color: colors.foreground }]}>
                        {item.tripDays} {item.tripDays === 1 ? "DAY" : "DAYS"}
                      </Text>
                    </View>
                    <View style={[s.pill, { borderColor: colors.border, backgroundColor: PACE_COLORS[item.pace] ?? "#FEF3C7" }]}>
                      <Text style={[s.pillText, { color: PACE_TEXT_COLORS[item.pace] ?? "#92400E" }]}>
                        {item.pace.toUpperCase()}
                      </Text>
                    </View>
                    <View style={[s.pill, { borderColor: colors.border, backgroundColor: "#FFFBEB" }]}>
                      <Text style={[s.pillText, { color: colors.foreground }]}>{stops} STOPS</Text>
                    </View>
                    {item.isOptimized && (
                      <View style={[s.pill, { borderColor: colors.border, backgroundColor: colors.teal }]}>
                        <Text style={[s.pillText, { color: "#fff" }]}>OPTIMISED</Text>
                      </View>
                    )}
                  </View>

                  {/* Footer */}
                  <View style={[s.cardFooter, { borderTopColor: colors.border }]}>
                    <Text style={[s.footerMono, { color: colors.mutedForeground }]}>
                      {new Date(item.createdAt)
                        .toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        .toUpperCase()}
                    </Text>
                    <View style={s.cardActions}>
                      <TouchableOpacity
                        style={s.actionBtn}
                        onPress={() => startRename(item)}
                        disabled={isDeleting}
                      >
                        <Feather name="edit-2" size={14} color={colors.teal} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.actionBtn}
                        onPress={() => handleDelete(item.id, displayName)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <Feather name="trash-2" size={14} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, topPad: number) {
  return StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingTop: topPad + 16,
      paddingBottom: 16,
      borderBottomWidth: 2,
    },
    title: { fontFamily: "DMSerifDisplay_400Italic", fontSize: 36 },
    scroll: { paddingHorizontal: 20, paddingTop: 20 },
    section: { marginBottom: 28 },
    sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    sectionDot: { width: 8, height: 8, borderRadius: 4 },
    sectionLabel: { fontFamily: "SpaceMono_700Bold", fontSize: 9, letterSpacing: 2 },

    // Current card
    currentCard: {
      borderWidth: 2,
      borderRadius: 4,
      backgroundColor: "#F0FDFA",
      padding: 16,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
    currentCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
    currentMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
    liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#14B8A6" },
    liveLabel: { fontFamily: "SpaceMono_700Bold", fontSize: 9, letterSpacing: 1.5 },
    currentStamp: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      transform: [{ rotate: "12deg" }],
    },
    currentCity: { fontFamily: "DMSerifDisplay_400Italic", fontSize: 30, marginBottom: 10 },
    currentPills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
    currentFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 2, paddingTop: 10 },
    openBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 2 },
    openBadgeText: { fontFamily: "SpaceMono_700Bold", fontSize: 9, letterSpacing: 1 },

    // Saved cards
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
    stamp: {
      position: "absolute",
      top: -8,
      right: 14,
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      transform: [{ rotate: "12deg" }],
    },
    stampText: { fontFamily: "SpaceMono_700Bold", fontSize: 10, color: "#fff" },
    stampYear: { fontFamily: "SpaceMono_400Regular", fontSize: 7, color: "rgba(255,255,255,0.8)" },
    cardName: { fontFamily: "DMSerifDisplay_400Italic", fontSize: 26, marginBottom: 4, paddingRight: 52 },
    cardSubCity: { fontFamily: "SpaceMono_400Regular", fontSize: 10, marginBottom: 8, letterSpacing: 0.5 },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
    pill: { borderWidth: 2, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    pillText: { fontFamily: "SpaceMono_700Bold", fontSize: 9 },
    cardFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 2,
      paddingTop: 10,
    },
    footerMono: { fontFamily: "SpaceMono_400Regular", fontSize: 9 },
    cardActions: { flexDirection: "row", gap: 12, alignItems: "center" },
    actionBtn: { padding: 4 },

    // Rename
    renameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, paddingRight: 52 },
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
    renameActionBtn: {
      width: 34,
      height: 34,
      borderWidth: 2,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
    },

    // Empty
    emptyCard: {
      borderWidth: 2,
      borderRadius: 4,
      borderStyle: "dashed",
      padding: 28,
      alignItems: "center",
      gap: 12,
    },
    emptyCardText: {
      fontFamily: "SpaceMono_400Regular",
      fontSize: 12,
      textAlign: "center",
      lineHeight: 18,
    },
    planBtn: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderWidth: 2,
      borderRadius: 4,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
      marginTop: 4,
    },
    planBtnText: { fontFamily: "SpaceMono_700Bold", fontSize: 11, color: "#fff", letterSpacing: 1.5 },
  });
}
