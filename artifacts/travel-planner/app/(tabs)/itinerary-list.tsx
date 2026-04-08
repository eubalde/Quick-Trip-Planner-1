import React, { useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useItinerary } from "@/context/ItineraryContext";

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
  const { currentItinerary } = useItinerary();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleOpenCurrent = useCallback(() => {
    Haptics.selectionAsync();
    router.push("/itinerary");
  }, [router]);

  const totalStops = (item: { days: { activities: { id: string }[] }[] }) =>
    item.days.reduce((s, d) => s + d.activities.length, 0);

  const s = makeStyles(colors, topPad);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <View style={[s.header, { borderBottomColor: colors.border }]}>
        <Text style={[s.title, { color: colors.foreground }]}>Itinerary.</Text>
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
                  <View style={s.liveDot} />
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
                <View
                  style={[
                    s.pill,
                    {
                      borderColor: colors.border,
                      backgroundColor: PACE_COLORS[currentItinerary.pace] ?? "#FEF3C7",
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.pillText,
                      { color: PACE_TEXT_COLORS[currentItinerary.pace] ?? "#92400E" },
                    ]}
                  >
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
                <Text style={[s.footerMono, { color: colors.mutedForeground }]} numberOfLines={1}>
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
                style={[
                  s.planBtn,
                  {
                    backgroundColor: colors.primary,
                    borderColor: colors.border,
                    shadowColor: colors.border,
                  },
                ]}
                onPress={() => router.push("/(tabs)/")}
              >
                <Text style={s.planBtnText}>GO TO PLAN</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── TIPS ─────────────────────────────────────────────── */}
        <View style={[s.tipsCard, { borderColor: colors.border, backgroundColor: "#FFFBEB" }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[s.tipsText, { color: colors.mutedForeground }]}>
            Generate a trip on the Plan tab, then save it to keep it forever. Manage your saved trips in the{" "}
            <Text style={{ fontFamily: "SpaceMono_700Bold" }}>Saved</Text> tab.
          </Text>
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
    section: { marginBottom: 24 },
    sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    sectionDot: { width: 8, height: 8, borderRadius: 4 },
    sectionLabel: {
      fontFamily: "SpaceMono_700Bold",
      fontSize: 9,
      letterSpacing: 2,
    },

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
    currentCardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 8,
    },
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
    stampText: { fontFamily: "SpaceMono_700Bold", fontSize: 10, color: "#fff" },
    currentCity: { fontFamily: "DMSerifDisplay_400Italic", fontSize: 30, marginBottom: 10 },
    currentPills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
    currentFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 2,
      paddingTop: 10,
    },
    openBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 2 },
    openBadgeText: { fontFamily: "SpaceMono_700Bold", fontSize: 9, letterSpacing: 1 },
    footerMono: { fontFamily: "SpaceMono_400Regular", fontSize: 9, flex: 1, marginRight: 8 },

    // Badges
    pill: { borderWidth: 2, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    pillText: { fontFamily: "SpaceMono_700Bold", fontSize: 9 },

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
    planBtnText: {
      fontFamily: "SpaceMono_700Bold",
      fontSize: 11,
      color: "#fff",
      letterSpacing: 1.5,
    },

    // Tips
    tipsCard: {
      flexDirection: "row",
      gap: 10,
      borderWidth: 2,
      borderRadius: 4,
      padding: 14,
      alignItems: "flex-start",
    },
    tipsText: {
      flex: 1,
      fontFamily: "SpaceMono_400Regular",
      fontSize: 10,
      lineHeight: 16,
    },
  });
}
