import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useItinerary, Activity, DayPlan } from "@/context/ItineraryContext";
import { useAuth } from "@/context/AuthContext";

const CATEGORY_ICONS: Record<string, string> = {
  museum: "book-open",
  landmark: "flag",
  park: "sun",
  restaurant: "coffee",
  shopping: "shopping-bag",
  entertainment: "tv",
  cultural: "globe",
  outdoor: "wind",
  nightlife: "moon",
  tour: "map",
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  museum: { bg: "#dbeafe", text: "#1d4ed8" },
  landmark: { bg: "#fef3c7", text: "#d97706" },
  park: { bg: "#d1fae5", text: "#059669" },
  restaurant: { bg: "#fee2e2", text: "#dc2626" },
  shopping: { bg: "#fce7f3", text: "#db2777" },
  entertainment: { bg: "#ede9fe", text: "#7c3aed" },
  cultural: { bg: "#ffedd5", text: "#ea580c" },
  outdoor: { bg: "#ecfdf5", text: "#10b981" },
  nightlife: { bg: "#1e1b4b", text: "#a5b4fc" },
  tour: { bg: "#f0f9ff", text: "#0369a1" },
};

function ActivityCard({
  activity,
  dayIndex,
  activityIndex,
  total,
  onRemove,
  onMoveUp,
  onMoveDown,
  colors,
}: {
  activity: Activity;
  dayIndex: number;
  activityIndex: number;
  total: number;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const catColor = CATEGORY_COLORS[activity.category] ?? { bg: colors.secondary, text: colors.mutedForeground };
  const icon = CATEGORY_ICONS[activity.category] ?? "map-pin";

  return (
    <View style={[styles.activityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.activityHeader}>
        <View style={[styles.catBadge, { backgroundColor: catColor.bg }]}>
          <Feather name={icon as any} size={12} color={catColor.text} style={{ marginRight: 4 }} />
          <Text style={[styles.catText, { color: catColor.text }]}>{activity.category}</Text>
        </View>
        <View style={styles.activityActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { opacity: activityIndex === 0 ? 0.3 : 1 }]}
            onPress={onMoveUp}
            disabled={activityIndex === 0}
          >
            <Feather name="chevron-up" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { opacity: activityIndex === total - 1 ? 0.3 : 1 }]}
            onPress={onMoveDown}
            disabled={activityIndex === total - 1}
          >
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={onRemove}>
            <Feather name="x" size={16} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.activityName, { color: colors.foreground }]}>{activity.name}</Text>
      <Text style={[styles.activityDesc, { color: colors.mutedForeground }]} numberOfLines={3}>
        {activity.description}
      </Text>

      <View style={styles.activityMeta}>
        {activity.address ? (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={12} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {activity.address}
            </Text>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <Feather name="clock" size={12} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
            ~{activity.estimated_duration} min
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function ItineraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentItinerary, removeActivity, reorderActivity, hasUnsavedChanges, tripInput } = useItinerary();
  const { user, token } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const { setCurrentItinerary } = useItinerary();

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleBack = () => {
    if (hasUnsavedChanges) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. Are you sure you want to go back?",
        [
          { text: "Stay", style: "cancel" },
          { text: "Leave", style: "destructive", onPress: () => router.back() },
        ]
      );
    } else {
      router.back();
    }
  };

  const handleSave = async () => {
    if (!user || !token) {
      Alert.alert(
        "Sign In Required",
        "Please sign in to save your itinerary.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign In", onPress: () => router.push("/auth") },
        ]
      );
      return;
    }

    if (!currentItinerary) return;
    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const res = await fetch(`${apiBase}/api/itinerary`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          city: currentItinerary.city,
          tripDays: currentItinerary.tripDays,
          pace: currentItinerary.pace,
          interests: currentItinerary.interests,
          days: currentItinerary.days,
          isOptimized: currentItinerary.isOptimized,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save");
      }

      const saved = await res.json();
      setCurrentItinerary({ ...currentItinerary, id: saved.id });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Saved!", "Your itinerary has been saved.");
    } catch {
      Alert.alert("Error", "Could not save itinerary. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!tripInput) return;
    setIsRegenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const seed = Math.floor(Math.random() * 100000);
      const res = await fetch(`${apiBase}/api/itinerary/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tripInput, seed }),
      });

      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data.error ?? "Failed to regenerate");
        return;
      }

      setCurrentItinerary(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not regenerate. Please try again.");
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!currentItinerary) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No itinerary loaded</Text>
        </View>
      </View>
    );
  }

  const totalHours = currentItinerary.days
    .flatMap((d) => d.activities)
    .reduce((sum, a) => sum + a.estimated_duration, 0);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.topActions}>
          {tripInput && (
            <TouchableOpacity
              style={[styles.topBtn, { borderColor: colors.border }]}
              onPress={handleRegenerate}
              disabled={isRegenerating}
            >
              {isRegenerating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="refresh-cw" size={16} color={colors.foreground} />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>{currentItinerary.id ? "Saved" : "Save"}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Platform.OS === "web" ? 40 : 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <View style={styles.cityRow}>
            <Feather name="map-pin" size={20} color={colors.primary} style={{ marginRight: 6 }} />
            <Text style={[styles.cityName, { color: colors.foreground }]}>{currentItinerary.city}</Text>
          </View>
          <View style={styles.metaBadges}>
            {currentItinerary.isOptimized ? (
              <View style={[styles.badge, { backgroundColor: "#d1fae5" }]}>
                <Feather name="check-circle" size={11} color="#065f46" style={{ marginRight: 4 }} />
                <Text style={[styles.badgeText, { color: "#065f46" }]}>Route Optimized</Text>
              </View>
            ) : (
              <View style={[styles.badge, { backgroundColor: "#fef3c7" }]}>
                <Feather name="alert-circle" size={11} color="#d97706" style={{ marginRight: 4 }} />
                <Text style={[styles.badgeText, { color: "#d97706" }]}>Changes may affect efficiency</Text>
              </View>
            )}
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {currentItinerary.tripDays}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                {currentItinerary.tripDays === 1 ? "day" : "days"}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {currentItinerary.days.flatMap((d) => d.activities).length}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>activities</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {Math.round(totalHours / 60)}h
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>total</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.foreground }]} numberOfLines={1}>
                {currentItinerary.pace}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>pace</Text>
            </View>
          </View>
        </View>

        {currentItinerary.days.map((day) => (
          <View key={day.day} style={styles.daySection}>
            <View style={styles.dayHeader}>
              <View style={[styles.dayNumBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.dayNumText}>{day.day}</Text>
              </View>
              <Text style={[styles.dayTitle, { color: colors.foreground }]}>Day {day.day}</Text>
              <Text style={[styles.dayActivityCount, { color: colors.mutedForeground }]}>
                {day.activities.length} {day.activities.length === 1 ? "activity" : "activities"}
              </Text>
            </View>

            {day.activities.length === 0 ? (
              <View style={[styles.emptyDayCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                <Text style={[styles.emptyDayText, { color: colors.mutedForeground }]}>
                  All activities removed
                </Text>
              </View>
            ) : (
              day.activities.map((activity, idx) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  dayIndex={day.day}
                  activityIndex={idx}
                  total={day.activities.length}
                  colors={colors}
                  onRemove={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    removeActivity(day.day, activity.id);
                  }}
                  onMoveUp={() => {
                    Haptics.selectionAsync();
                    reorderActivity(day.day, idx, idx - 1);
                  }}
                  onMoveDown={() => {
                    Haptics.selectionAsync();
                    reorderActivity(day.day, idx, idx + 1);
                  }}
                />
              ))
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: { padding: 4 },
  topActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  topBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  scrollContent: { paddingHorizontal: 20 },
  heroSection: { marginBottom: 24 },
  cityRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  cityName: { fontSize: 30, fontFamily: "Inter_700Bold" },
  metaBadges: { flexDirection: "row", gap: 8, marginBottom: 16 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  statItem: { alignItems: "center" },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  statDivider: { width: 1, height: 32 },
  daySection: { marginBottom: 24 },
  dayHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  dayNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  dayTitle: { fontSize: 18, fontFamily: "Inter_700Bold", flex: 1 },
  dayActivityCount: { fontSize: 13, fontFamily: "Inter_400Regular" },
  activityCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  activityHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  catBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  catText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  activityActions: { flexDirection: "row", gap: 4 },
  actionBtn: { padding: 4 },
  activityName: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  activityDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, marginBottom: 10 },
  activityMeta: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyDayCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    padding: 20,
    alignItems: "center",
  },
  emptyDayText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 16, fontFamily: "Inter_400Regular" },
});
