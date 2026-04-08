import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
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

// ─── Add Event Modal ───────────────────────────────────────────────────────────

const ALL_CATEGORIES: { value: string; label: string }[] = [
  { value: "museum", label: "Museum" },
  { value: "landmark", label: "Landmark" },
  { value: "park", label: "Park" },
  { value: "restaurant", label: "Dining" },
  { value: "shopping", label: "Shopping" },
  { value: "entertainment", label: "Entertainment" },
  { value: "cultural", label: "Cultural" },
  { value: "outdoor", label: "Outdoor" },
  { value: "nightlife", label: "Nightlife" },
  { value: "tour", label: "Tour" },
];

interface AddEventModalProps {
  visible: boolean;
  dayNum: number;
  onAdd: (activity: Activity) => void;
  onClose: () => void;
  colors: ReturnType<typeof useColors>;
}

function AddEventModal({ visible, dayNum, onAdd, onClose, colors }: AddEventModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("landmark");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [durationStr, setDurationStr] = useState("60");
  const [h, setH] = useState(9);
  const [m, setM] = useState(0);

  const reset = () => {
    setName(""); setCategory("landmark"); setDescription("");
    setAddress(""); setDurationStr("60"); setH(9); setM(0);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleAdd = () => {
    if (!name.trim()) { Alert.alert("Missing Name", "Enter an event name."); return; }
    const duration = parseInt(durationStr, 10);
    if (isNaN(duration) || duration < 1) { Alert.alert("Invalid Duration", "Enter a duration in minutes."); return; }
    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onAdd({ id, name: name.trim(), category: category as any, estimated_duration: duration, description: description.trim(), address: address.trim() || undefined, time });
    reset();
  };

  const clampH = (n: number) => Math.min(22, Math.max(6, n));
  const cycleMins = (n: number) => ((n % 60) + 60) % 60;
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;

  const s = aeStyles;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={s.overlay}>
          <View style={[s.sheet, { backgroundColor: "#FFFBEB", borderColor: colors.border, shadowColor: colors.border }]}>
            {/* Header */}
            <View style={[s.header, { borderBottomColor: colors.border }]}>
              <Text style={[s.title, { color: colors.foreground }]}>
                ADD EVENT — DAY {String(dayNum).padStart(2, "0")}
              </Text>
              <TouchableOpacity onPress={handleClose}>
                <Feather name="x" size={18} color={colors.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Name */}
              <View style={s.field}>
                <Text style={[s.label, { color: colors.mutedForeground }]}>EVENT NAME *</Text>
                <View style={[s.inputRow, { borderColor: colors.border }]}>
                  <TextInput
                    style={[s.input, { color: colors.foreground }]}
                    placeholder="e.g. Senso-ji Temple"
                    placeholderTextColor={colors.mutedForeground}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Category */}
              <View style={s.field}>
                <Text style={[s.label, { color: colors.mutedForeground }]}>CATEGORY</Text>
                <View style={s.chipGrid}>
                  {ALL_CATEGORIES.map((c) => {
                    const sel = category === c.value;
                    return (
                      <TouchableOpacity
                        key={c.value}
                        style={[s.chip, { borderColor: colors.border, backgroundColor: sel ? colors.primary : "transparent" }]}
                        onPress={() => { Haptics.selectionAsync(); setCategory(c.value); }}
                      >
                        <Text style={[s.chipText, { color: sel ? "#fff" : colors.foreground }]}>{c.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Time */}
              <View style={s.field}>
                <Text style={[s.label, { color: colors.mutedForeground }]}>START TIME</Text>
                <View style={s.timeRow}>
                  {/* Hour */}
                  <View style={s.timeCol}>
                    <TouchableOpacity style={[s.arrowBtn, { borderColor: colors.border }]} onPress={() => { Haptics.selectionAsync(); setH(clampH(h + 1)); }}>
                      <Feather name="chevron-up" size={18} color={colors.foreground} />
                    </TouchableOpacity>
                    <View style={[s.timeBox, { borderColor: colors.border }]}>
                      <Text style={[s.timeNum, { color: colors.foreground }]}>{String(h).padStart(2, "0")}</Text>
                    </View>
                    <TouchableOpacity style={[s.arrowBtn, { borderColor: colors.border }]} onPress={() => { Haptics.selectionAsync(); setH(clampH(h - 1)); }}>
                      <Feather name="chevron-down" size={18} color={colors.foreground} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[s.colon, { color: colors.foreground }]}>:</Text>
                  {/* Minute */}
                  <View style={s.timeCol}>
                    <TouchableOpacity style={[s.arrowBtn, { borderColor: colors.border }]} onPress={() => { Haptics.selectionAsync(); setM(cycleMins(m + 15)); }}>
                      <Feather name="chevron-up" size={18} color={colors.foreground} />
                    </TouchableOpacity>
                    <View style={[s.timeBox, { borderColor: colors.border }]}>
                      <Text style={[s.timeNum, { color: colors.foreground }]}>{String(m).padStart(2, "0")}</Text>
                    </View>
                    <TouchableOpacity style={[s.arrowBtn, { borderColor: colors.border }]} onPress={() => { Haptics.selectionAsync(); setM(cycleMins(m - 15)); }}>
                      <Feather name="chevron-down" size={18} color={colors.foreground} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[s.ampm, { color: colors.mutedForeground }]}>{h12}:{String(m).padStart(2,"0")} {ampm}</Text>
                </View>
              </View>

              {/* Duration */}
              <View style={s.field}>
                <Text style={[s.label, { color: colors.mutedForeground }]}>DURATION (MINUTES)</Text>
                <View style={[s.inputRow, { borderColor: colors.border }]}>
                  <TextInput
                    style={[s.input, { color: colors.foreground }]}
                    placeholder="60"
                    placeholderTextColor={colors.mutedForeground}
                    value={durationStr}
                    onChangeText={setDurationStr}
                    keyboardType="number-pad"
                  />
                  <Text style={[s.unit, { color: colors.mutedForeground }]}>min</Text>
                </View>
              </View>

              {/* Description */}
              <View style={s.field}>
                <Text style={[s.label, { color: colors.mutedForeground }]}>DESCRIPTION (OPTIONAL)</Text>
                <View style={[s.inputRow, { borderColor: colors.border, alignItems: "flex-start", minHeight: 72, paddingTop: 10 }]}>
                  <TextInput
                    style={[s.input, { color: colors.foreground, textAlignVertical: "top" }]}
                    placeholder="Notes about this stop..."
                    placeholderTextColor={colors.mutedForeground}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              </View>

              {/* Address */}
              <View style={s.field}>
                <Text style={[s.label, { color: colors.mutedForeground }]}>ADDRESS (OPTIONAL)</Text>
                <View style={[s.inputRow, { borderColor: colors.border }]}>
                  <Feather name="map-pin" size={13} color={colors.mutedForeground} style={{ marginRight: 6 }} />
                  <TextInput
                    style={[s.input, { color: colors.foreground }]}
                    placeholder="Street address or neighbourhood"
                    placeholderTextColor={colors.mutedForeground}
                    value={address}
                    onChangeText={setAddress}
                  />
                </View>
              </View>

              {/* Actions */}
              <View style={s.btnRow}>
                <TouchableOpacity
                  style={[s.cancelBtn, { borderColor: colors.border }]}
                  onPress={handleClose}
                >
                  <Text style={[s.cancelText, { color: colors.foreground }]}>CANCEL</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.addBtn, { backgroundColor: colors.primary, borderColor: colors.border, shadowColor: colors.border }]}
                  onPress={handleAdd}
                >
                  <Feather name="plus" size={14} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={s.addBtnText}>ADD EVENT</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const aeStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(69,26,3,0.45)", justifyContent: "flex-end" },
  sheet: {
    borderWidth: 2, borderBottomWidth: 0, borderTopLeftRadius: 12, borderTopRightRadius: 12,
    maxHeight: "90%", paddingHorizontal: 20, paddingBottom: 32,
    shadowOffset: { width: 0, height: -4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 8,
  },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderBottomWidth: 2, paddingVertical: 14, marginBottom: 16,
  },
  title: { fontFamily: "SpaceMono_700Bold", fontSize: 11, letterSpacing: 2 },
  field: { marginBottom: 16 },
  label: { fontFamily: "SpaceMono_700Bold", fontSize: 9, letterSpacing: 2, marginBottom: 8 },
  inputRow: {
    flexDirection: "row", alignItems: "center", borderWidth: 2, borderRadius: 4,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#FEF3C7",
  },
  input: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 15 },
  unit: { fontFamily: "SpaceMono_400Regular", fontSize: 10, marginLeft: 6 },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderWidth: 2, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 6 },
  chipText: { fontFamily: "SpaceMono_700Bold", fontSize: 9 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  timeCol: { alignItems: "center", gap: 4 },
  arrowBtn: { width: 40, height: 32, borderWidth: 2, borderRadius: 4, alignItems: "center", justifyContent: "center" },
  timeBox: { width: 56, height: 44, borderWidth: 2, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#FEF3C7" },
  timeNum: { fontFamily: "DMSerifDisplay_400Regular", fontSize: 24 },
  colon: { fontFamily: "DMSerifDisplay_400Regular", fontSize: 28 },
  ampm: { fontFamily: "SpaceMono_400Regular", fontSize: 13, marginLeft: 6 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderWidth: 2, borderRadius: 4, alignItems: "center" },
  cancelText: { fontFamily: "SpaceMono_700Bold", fontSize: 11, letterSpacing: 1 },
  addBtn: {
    flex: 2, flexDirection: "row", paddingVertical: 14, borderWidth: 2, borderRadius: 4,
    alignItems: "center", justifyContent: "center",
    shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4,
  },
  addBtnText: { fontFamily: "SpaceMono_700Bold", fontSize: 11, color: "#fff", letterSpacing: 2 },
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
  const [expanded, setExpanded] = useState(false);
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
          <TouchableOpacity
            onPress={() => { Haptics.selectionAsync(); setExpanded((e) => !e); }}
            activeOpacity={0.8}
          >
            <Text style={[cardStyles.desc, { color: colors.mutedForeground }]} numberOfLines={expanded ? undefined : 2}>
              {activity.description}
            </Text>
            <Text style={[cardStyles.expandToggle, { color: colors.primary }]}>
              {expanded ? "SHOW LESS ↑" : "READ MORE ↓"}
            </Text>
          </TouchableOpacity>
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
  desc: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 18, marginBottom: 4 },
  expandToggle: { fontFamily: "SpaceMono_700Bold", fontSize: 9, letterSpacing: 1, marginBottom: 8 },
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
  const { currentItinerary, removeActivity, reorderActivity, updateActivityTime, addActivity, tripInput, setCurrentItinerary } = useItinerary();
  const { user, token, logout } = useAuth();

  const [isSaving, setIsSaving] = useState(false);
  const [isRegen, setIsRegen] = useState(false);
  const [addEventVisible, setAddEventVisible] = useState(false);
  const [addEventTargetDay, setAddEventTargetDay] = useState(1);

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
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
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
      if (res.status === 401) {
        // Session has expired — log out locally and prompt re-authentication
        await logout();
        Alert.alert(
          "Session Expired",
          "Your session has expired. Please sign in again to save your itinerary.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Sign In", onPress: () => router.push("/auth") },
          ]
        );
        return;
      }
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
          <View style={[s.fallbackNote, { borderColor: colors.border, borderLeftColor: "#14B8A6" }]}>
            <Feather name="info" size={14} color="#14B8A6" />
            <Text style={[s.fallbackText, { color: colors.mutedForeground }]}>
              AI-generated venues — confirm opening hours and current status before visiting.
            </Text>
          </View>
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
              {tripInput?.startDate ? (() => {
                const d = new Date(tripInput.startDate);
                d.setDate(d.getDate() + (day.day - 1));
                const label = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
                return <Text style={[s.dayDateLabel, { color: colors.mutedForeground }]}>{label}</Text>;
              })() : null}
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
                  NO EVENTS YET
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

            {/* ADD EVENT BUTTON */}
            <TouchableOpacity
              style={[s.addEventBtn, { borderColor: colors.primary }]}
              onPress={() => { Haptics.selectionAsync(); setAddEventTargetDay(day.day); setAddEventVisible(true); }}
              activeOpacity={0.8}
            >
              <Feather name="plus" size={14} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[s.addEventBtnText, { color: colors.primary }]}>ADD EVENT</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* ADD EVENT MODAL */}
      <AddEventModal
        visible={addEventVisible}
        dayNum={addEventTargetDay}
        colors={colors}
        onClose={() => setAddEventVisible(false)}
        onAdd={(activity) => { addActivity(addEventTargetDay, activity); setAddEventVisible(false); }}
      />

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
    dayDateLabel: { fontFamily: "SpaceMono_400Regular", fontSize: 9, marginRight: 2 },
    dayTitle: { fontFamily: "SpaceMono_700Bold", fontSize: 14, flex: 1 },
    mono: { fontFamily: "SpaceMono_400Regular" },
    emptyDay: {
      borderWidth: 2,
      borderStyle: "dashed",
      borderRadius: 4,
      padding: 20,
      alignItems: "center",
    },
    addEventBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderStyle: "dashed",
      borderRadius: 4,
      paddingVertical: 12,
      marginTop: 8,
    },
    addEventBtnText: {
      fontFamily: "SpaceMono_700Bold",
      fontSize: 10,
      letterSpacing: 2,
    },
    empty: { flex: 1, alignItems: "center", justifyContent: "center" },
    emptyText: { fontFamily: "SpaceMono_400Regular", fontSize: 12 },
  });
}
