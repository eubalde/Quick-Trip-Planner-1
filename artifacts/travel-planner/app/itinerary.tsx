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
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useItinerary, Activity } from "@/context/ItineraryContext";
import { useAuth } from "@/context/AuthContext";

const CATEGORY_TAGS: Record<string, string> = {
  museum: "#MUSEUM",
  landmark: "#LANDMARK",
  park: "#PARK",
  restaurant: "#DINING",
  shopping: "#SHOPPING",
  entertainment: "#ENTERTAIN",
  cultural: "#CULTURE",
  outdoor: "#OUTDOOR",
  nightlife: "#NIGHT",
  tour: "#TOUR",
};

function refCode(city: string, day: number, idx: number): string {
  return `${city.slice(0, 3).toUpperCase()}-D${day}-V${idx + 1}`;
}

// ─── Time Picker Modal ─────────────────────────────────────────────────────────

interface TimePickerProps {
  visible: boolean;
  value: string; // "HH:MM"
  onConfirm: (time: string) => void;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}

function TimePicker({ visible, value, onConfirm, onClose, colors }: TimePickerProps) {
  const [h, setH] = useState(() => parseInt(value.split(":")[0] ?? "9", 10));
  const [m, setM] = useState(() => {
    const raw = parseInt(value.split(":")[1] ?? "0", 10);
    // snap to nearest 15
    return Math.round(raw / 15) * 15 % 60;
  });

  const clampH = (n: number) => Math.min(22, Math.max(6, n));
  const cycleMins = (n: number) => ((n % 60) + 60) % 60;

  const formatted = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const display12 = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;

  const s = tpStyles;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.sheet, { backgroundColor: "#FFFBEB", borderColor: colors.border, shadowColor: colors.border }]}>
          {/* Header */}
          <View style={[s.sheetHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.sheetTitle, { color: colors.foreground }]}>Set Time</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={18} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Big time display */}
          <Text style={[s.bigTime, { color: colors.foreground }]}>{display12}</Text>

          {/* Pickers */}
          <View style={s.pickersRow}>
            {/* Hour column */}
            <View style={s.pickerCol}>
              <Text style={[s.pickerLabel, { color: colors.mutedForeground }]}>HOUR</Text>
              <TouchableOpacity
                style={[s.arrowBtn, { borderColor: colors.border }]}
                onPress={() => { Haptics.selectionAsync(); setH(clampH(h + 1)); }}
              >
                <Feather name="chevron-up" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <View style={[s.valueBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[s.valueText, { color: colors.foreground }]}>{String(h).padStart(2, "0")}</Text>
              </View>
              <TouchableOpacity
                style={[s.arrowBtn, { borderColor: colors.border }]}
                onPress={() => { Haptics.selectionAsync(); setH(clampH(h - 1)); }}
              >
                <Feather name="chevron-down" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <Text style={[s.colon, { color: colors.foreground }]}>:</Text>

            {/* Minute column */}
            <View style={s.pickerCol}>
              <Text style={[s.pickerLabel, { color: colors.mutedForeground }]}>MIN</Text>
              <TouchableOpacity
                style={[s.arrowBtn, { borderColor: colors.border }]}
                onPress={() => { Haptics.selectionAsync(); setM(cycleMins(m + 15)); }}
              >
                <Feather name="chevron-up" size={20} color={colors.foreground} />
              </TouchableOpacity>
              <View style={[s.valueBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[s.valueText, { color: colors.foreground }]}>{String(m).padStart(2, "0")}</Text>
              </View>
              <TouchableOpacity
                style={[s.arrowBtn, { borderColor: colors.border }]}
                onPress={() => { Haptics.selectionAsync(); setM(cycleMins(m - 15)); }}
              >
                <Feather name="chevron-down" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm */}
          <TouchableOpacity
            style={[s.confirmBtn, { backgroundColor: colors.primary, borderColor: colors.border, shadowColor: colors.border }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onConfirm(formatted); }}
          >
            <Feather name="check" size={14} color="#fff" style={{ marginRight: 6 }} />
            <Text style={s.confirmText}>CONFIRM TIME</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const tpStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(69,26,3,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  sheet: {
    width: "100%",
    maxWidth: 320,
    borderWidth: 2,
    borderRadius: 4,
    padding: 20,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    paddingBottom: 12,
    marginBottom: 16,
  },
  sheetTitle: { fontFamily: "SpaceMono_700Bold", fontSize: 11, letterSpacing: 2 },
  bigTime: {
    fontFamily: "DMSerifDisplay_400Regular",
    fontSize: 48,
    textAlign: "center",
    marginBottom: 20,
  },
  pickersRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 20,
  },
  pickerCol: { alignItems: "center", gap: 6 },
  pickerLabel: { fontFamily: "SpaceMono_400Regular", fontSize: 9, letterSpacing: 2 },
  arrowBtn: {
    width: 44,
    height: 36,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  valueBox: {
    width: 72,
    height: 52,
    borderWidth: 2,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  valueText: { fontFamily: "DMSerifDisplay_400Regular", fontSize: 30 },
  colon: { fontFamily: "DMSerifDisplay_400Regular", fontSize: 36, marginTop: 20 },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderWidth: 2,
    borderRadius: 4,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  confirmText: { fontFamily: "SpaceMono_700Bold", fontSize: 11, color: "#fff", letterSpacing: 2 },
});

// ─── Activity Card ─────────────────────────────────────────────────────────────

interface ActivityCardProps {
  activity: Activity;
  day: number;
  idx: number;
  total: number;
  city: string;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTimePress: () => void;
  colors: ReturnType<typeof useColors>;
}

function ActivityCard({
  activity,
  day,
  idx,
  total,
  city,
  onRemove,
  onMoveUp,
  onMoveDown,
  onTimePress,
  colors,
}: ActivityCardProps) {
  const tag = CATEGORY_TAGS[activity.category] ?? "#MISC";
  const ref = refCode(city, day, idx);
  const timeStr = activity.time ?? "09:00";
  const [hRaw, mRaw] = timeStr.split(":").map(Number);
  const h = hRaw ?? 9;
  const m = mRaw ?? 0;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const display = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;

  return (
    <View style={[cardStyles.card, { borderColor: colors.border, shadowColor: colors.border }]}>
      <View style={cardStyles.row}>
        <View style={cardStyles.timeCol}>
          {/* Tappable time */}
          <TouchableOpacity
            onPress={onTimePress}
            style={[cardStyles.timeBtn, { borderColor: colors.primary, backgroundColor: "#FEF2E8" }]}
            activeOpacity={0.75}
          >
            <Text style={[cardStyles.time, { color: colors.primary }]}>{display}</Text>
            <Feather name="edit-2" size={9} color={colors.primary} style={{ marginTop: 2 }} />
          </TouchableOpacity>
          <Text style={[cardStyles.ref, { color: colors.mutedForeground }]}>{ref}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={cardStyles.nameRow}>
            <Text style={[cardStyles.name, { color: colors.foreground }]} numberOfLines={2}>
              {activity.name}
            </Text>
            <View style={[cardStyles.tagPill, { borderColor: colors.border, backgroundColor: "#FCD34D" }]}>
              <Text style={[cardStyles.tagText, { color: colors.foreground }]}>{tag}</Text>
            </View>
          </View>
          <Text style={[cardStyles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>
            {activity.description}
          </Text>
          <View style={cardStyles.metaRow}>
            <Feather name="clock" size={11} color={colors.mutedForeground} />
            <Text style={[cardStyles.metaMono, { color: colors.mutedForeground }]}>
              {activity.estimated_duration} MIN
            </Text>
            {activity.address ? (
              <>
                <Text style={{ color: colors.mutedForeground, marginHorizontal: 6 }}>·</Text>
                <Feather name="map-pin" size={11} color={colors.mutedForeground} />
                <Text style={[cardStyles.metaMono, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {activity.address}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={[cardStyles.actions, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          style={[cardStyles.actionBtn, { opacity: idx === 0 ? 0.25 : 1 }]}
          onPress={onMoveUp}
          disabled={idx === 0}
        >
          <Feather name="chevron-up" size={16} color={colors.foreground} />
          <Text style={[cardStyles.actionLabel, { color: colors.mutedForeground }]}>MOVE UP</Text>
        </TouchableOpacity>
        <View style={[cardStyles.actionDivider, { backgroundColor: colors.border }]} />
        <TouchableOpacity
          style={[cardStyles.actionBtn, { opacity: idx === total - 1 ? 0.25 : 1 }]}
          onPress={onMoveDown}
          disabled={idx === total - 1}
        >
          <Feather name="chevron-down" size={16} color={colors.foreground} />
          <Text style={[cardStyles.actionLabel, { color: colors.mutedForeground }]}>MOVE DN</Text>
        </TouchableOpacity>
        <View style={[cardStyles.actionDivider, { backgroundColor: colors.border }]} />
        <TouchableOpacity style={cardStyles.actionBtn} onPress={onRemove}>
          <Feather name="trash-2" size={16} color={colors.primary} />
          <Text style={[cardStyles.actionLabel, { color: colors.primary }]}>REMOVE</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderRadius: 4,
    backgroundColor: "#FFFBEB",
    marginBottom: 12,
    overflow: "hidden",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  row: { flexDirection: "row", gap: 12, padding: 14 },
  timeCol: { width: 72, gap: 4 },
  timeBtn: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 4,
    alignItems: "center",
  },
  time: { fontFamily: "SpaceMono_700Bold", fontSize: 11 },
  ref: { fontFamily: "SpaceMono_400Regular", fontSize: 7, textAlign: "center" },
  nameRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginBottom: 6, flexWrap: "wrap" },
  name: { fontFamily: "DMSerifDisplay_400Regular", fontSize: 17, flex: 1 },
  tagPill: { borderWidth: 2, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start" },
  tagText: { fontFamily: "SpaceMono_700Bold", fontSize: 8 },
  desc: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginBottom: 8 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  metaMono: { fontFamily: "SpaceMono_400Regular", fontSize: 9, marginLeft: 3 },
  actions: { flexDirection: "row", borderTopWidth: 2 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 4 },
  actionDivider: { width: 2 },
  actionLabel: { fontFamily: "SpaceMono_400Regular", fontSize: 8 },
});

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function ItineraryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentItinerary, removeActivity, reorderActivity, updateActivityTime, hasUnsavedChanges, tripInput, setCurrentItinerary } = useItinerary();
  const { user, token } = useAuth();

  const [isSaving, setIsSaving] = useState(false);
  const [isRegen, setIsRegen] = useState(false);

  // Time picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ day: number; activityId: string; time: string } | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const openTimePicker = (day: number, activityId: string, time: string) => {
    Haptics.selectionAsync();
    setPickerTarget({ day, activityId, time });
    setPickerVisible(true);
  };

  const handleTimeConfirm = (time: string) => {
    if (pickerTarget) {
      updateActivityTime(pickerTarget.day, pickerTarget.activityId, time);
    }
    setPickerVisible(false);
    setPickerTarget(null);
  };

  const handleBack = () => {
    if (hasUnsavedChanges) {
      Alert.alert("Unsaved Changes", "Leave without saving?", [
        { text: "Stay", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

  const handleSave = async () => {
    if (!user || !token) {
      Alert.alert("Auth Required", "Sign in to save itineraries.", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign In", onPress: () => router.push("/auth") },
      ]);
      return;
    }
    if (!currentItinerary) return;
    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const res = await fetch(`${apiBase}/api/itinerary`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          city: currentItinerary.city,
          tripDays: currentItinerary.tripDays,
          pace: currentItinerary.pace,
          interests: currentItinerary.interests,
          days: currentItinerary.days,
          isOptimized: currentItinerary.isOptimized,
        }),
      });
      if (!res.ok) throw new Error();
      const saved = await res.json();
      setCurrentItinerary({ ...currentItinerary, id: saved.id });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Postcard Saved", "Your itinerary is stored.");
    } catch {
      Alert.alert("Error", "Could not save. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegen = async () => {
    if (!tripInput) return;
    setIsRegen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const res = await fetch(`${apiBase}/api/itinerary/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tripInput, seed: Math.floor(Math.random() * 100000) }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert("Error", data.error ?? "Regen failed"); return; }
      setCurrentItinerary(data);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not regenerate.");
    } finally {
      setIsRegen(false);
    }
  };

  const s = makeItinStyles(colors);

  if (!currentItinerary) {
    return (
      <View style={[s.root, { backgroundColor: colors.background }]}>
        <View style={[s.topBar, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </TouchableOpacity>
        </View>
        <View style={s.empty}>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No itinerary loaded.</Text>
        </View>
      </View>
    );
  }

  const allActivities = currentItinerary.days.flatMap((d) => d.activities);
  const totalMins = allActivities.reduce((sum, a) => sum + a.estimated_duration, 0);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      {/* TOP BAR */}
      <View style={[s.topBar, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color={colors.foreground} />
        </TouchableOpacity>
        <View style={s.topActions}>
          {tripInput && (
            <TouchableOpacity
              style={[s.iconBtn, { borderColor: colors.border }]}
              onPress={handleRegen}
              disabled={isRegen}
            >
              {isRegen ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="refresh-cw" size={16} color={colors.foreground} />}
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: colors.primary, borderColor: colors.border, shadowColor: colors.border }]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>SAVE POSTCARD</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO */}
        <View style={s.hero}>
          <Text style={[s.heroCity, { color: colors.foreground }]}>{currentItinerary.city}.</Text>
          <View style={s.heroBadges}>
            <View style={[s.badge, { borderColor: colors.border, backgroundColor: colors.accent }]}>
              <Text style={[s.badgeMono, { color: colors.foreground }]}>
                {currentItinerary.tripDays} {currentItinerary.tripDays === 1 ? "DAY" : "DAYS"}
              </Text>
            </View>
            {!currentItinerary.isOptimized && (
              <View style={[s.badge, { borderColor: colors.border, backgroundColor: "#FCD34D" }]}>
                <Text style={[s.badgeMono, { color: colors.foreground }]}>⚠ EDITED</Text>
              </View>
            )}
            <View style={[s.badge, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Text style={[s.badgeMono, { color: colors.foreground }]}>
                {allActivities.length} STOPS · {Math.round(totalMins / 60)}H
              </Text>
            </View>
          </View>
          {!currentItinerary.isOptimized && (
            <View style={[s.fallbackNote, { borderColor: colors.border, borderLeftColor: "#FCD34D" }]}>
              <Feather name="alert-triangle" size={14} color="#D69E2E" />
              <Text style={[s.fallbackText, { color: colors.mutedForeground }]}>
                Changes may affect route efficiency. Re-optimisation not applied.
              </Text>
            </View>
          )}
        </View>

        {/* DAYS */}
        {currentItinerary.days.map((day) => (
          <View key={day.day} style={s.daySection}>
            <View style={[s.dayHeader, { borderBottomColor: colors.border }]}>
              <View style={[s.dayNumBox, { backgroundColor: colors.foreground }]}>
                <Text style={[s.dayNumText, { color: colors.accent }]}>
                  {String(day.day).padStart(2, "0")}
                </Text>
              </View>
              <Text style={[s.dayTitle, { color: colors.foreground }]}>
                DAY {String(day.day).padStart(2, "0")}
              </Text>
              <Text style={[s.mono, { color: colors.mutedForeground, fontSize: 9 }]}>
                {day.activities.length} STOPS
              </Text>
            </View>

            {day.activities.length === 0 ? (
              <View style={[s.emptyDay, { borderColor: colors.border }]}>
                <Text style={[s.mono, { color: colors.mutedForeground, fontSize: 10 }]}>
                  ALL ACTIVITIES REMOVED
                </Text>
              </View>
            ) : (
              day.activities.map((activity, idx) => (
                <ActivityCard
                  key={activity.id}
                  activity={activity}
                  day={day.day}
                  idx={idx}
                  total={day.activities.length}
                  city={currentItinerary.city}
                  colors={colors}
                  onRemove={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); removeActivity(day.day, activity.id); }}
                  onMoveUp={() => { Haptics.selectionAsync(); reorderActivity(day.day, idx, idx - 1); }}
                  onMoveDown={() => { Haptics.selectionAsync(); reorderActivity(day.day, idx, idx + 1); }}
                  onTimePress={() => openTimePicker(day.day, activity.id, activity.time ?? "09:00")}
                />
              ))
            )}
          </View>
        ))}
      </ScrollView>

      {/* TIME PICKER MODAL */}
      {pickerTarget && (
        <TimePicker
          visible={pickerVisible}
          value={pickerTarget.time}
          onConfirm={handleTimeConfirm}
          onClose={() => { setPickerVisible(false); setPickerTarget(null); }}
          colors={colors}
        />
      )}
    </View>
  );
}

function makeItinStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1 },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 12,
      borderBottomWidth: 2,
    },
    backBtn: { padding: 4 },
    topActions: { flexDirection: "row", gap: 8, alignItems: "center" },
    iconBtn: {
      width: 38,
      height: 38,
      borderWidth: 2,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    saveBtn: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderWidth: 2,
      borderRadius: 4,
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    saveBtnText: { fontFamily: "SpaceMono_700Bold", fontSize: 10, color: "#fff", letterSpacing: 1 },
    scroll: { paddingHorizontal: 20 },
    hero: { paddingVertical: 20 },
    heroCity: { fontFamily: "DMSerifDisplay_400Italic", fontSize: 44, marginBottom: 12 },
    heroBadges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
    badge: { borderWidth: 2, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 },
    badgeMono: { fontFamily: "SpaceMono_700Bold", fontSize: 9 },
    fallbackNote: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      borderWidth: 2,
      borderLeftWidth: 6,
      borderRadius: 4,
      padding: 10,
      backgroundColor: "#FFFBEB",
    },
    fallbackText: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, flex: 1 },
    daySection: { marginBottom: 24 },
    dayHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingBottom: 12,
      marginBottom: 12,
      borderBottomWidth: 2,
    },
    dayNumBox: { borderRadius: 4, paddingHorizontal: 10, paddingVertical: 6 },
    dayNumText: { fontFamily: "SpaceMono_700Bold", fontSize: 14 },
    dayTitle: { fontFamily: "SpaceMono_700Bold", fontSize: 14, flex: 1 },
    mono: { fontFamily: "SpaceMono_400Regular" },
    emptyDay: {
      borderWidth: 2,
      borderStyle: "dashed",
      borderRadius: 4,
      padding: 20,
      alignItems: "center",
    },
    empty: { flex: 1, alignItems: "center", justifyContent: "center" },
    emptyText: { fontFamily: "SpaceMono_400Regular", fontSize: 12 },
  });
}
