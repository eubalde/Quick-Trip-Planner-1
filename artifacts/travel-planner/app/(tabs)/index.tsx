import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useItinerary, TravelPace, UserInterest } from "@/context/ItineraryContext";

const INTERESTS: { value: UserInterest; label: string; tag: string }[] = [
  { value: "history", label: "History", tag: "#HISTORY" },
  { value: "art", label: "Art", tag: "#ART" },
  { value: "food", label: "Food", tag: "#FOOD" },
  { value: "nature", label: "Nature", tag: "#NATURE" },
  { value: "architecture", label: "Architecture", tag: "#ARCH" },
  { value: "nightlife", label: "Nightlife", tag: "#NIGHT" },
  { value: "shopping", label: "Shopping", tag: "#SHOP" },
  { value: "sports", label: "Sports", tag: "#SPORT" },
];

const PACES: { value: TravelPace; label: string; sub: string }[] = [
  { value: "relaxed", label: "RELAXED", sub: "2 stops/day" },
  { value: "standard", label: "STANDARD", sub: "3 stops/day" },
  { value: "packed", label: "PACKED", sub: "4 stops/day" },
];

const PROGRESS_LABELS = [
  "Mapping candidate clusters...",
  "Scoring interest alignment...",
  "Running nearest-neighbour...",
  "Verifying efficiency ratio...",
  "Finalising itinerary...",
];

export default function PlanScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { setCurrentItinerary, setTripInput } = useItinerary();

  const [city, setCity] = useState("");
  const [tripDays, setTripDays] = useState(2);
  const [interests, setInterests] = useState<UserInterest[]>([]);
  const [pace, setPace] = useState<TravelPace>("standard");
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 100 : 100;

  const toggleInterest = (v: UserInterest) => {
    Haptics.selectionAsync();
    setInterests((prev) =>
      prev.includes(v) ? prev.filter((i) => i !== v) : prev.length < 3 ? [...prev, v] : prev
    );
  };

  const handleGenerate = async () => {
    if (!city.trim()) {
      Alert.alert("Missing City", "Enter a destination to begin.");
      return;
    }
    if (interests.length === 0) {
      Alert.alert("No Interests", "Select at least one interest tag.");
      return;
    }

    setIsGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    let step = 0;
    setProgressLabel(PROGRESS_LABELS[0]!);
    const labelTimer = setInterval(() => {
      step++;
      if (step < PROGRESS_LABELS.length) {
        setProgressLabel(PROGRESS_LABELS[step]!);
      }
    }, 3500);

    try {
      const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const res = await fetch(`${apiBase}/api/itinerary/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: city.trim(), tripDays, interests, pace }),
      });
      const data = await res.json();
      if (!res.ok) {
        Alert.alert("Error", data.error ?? "Generation failed");
        return;
      }
      setCurrentItinerary(data);
      setTripInput({ city: city.trim(), tripDays, interests, pace });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push("/itinerary");
    } catch {
      Alert.alert("Connection Error", "Could not reach the server. Try again.");
    } finally {
      clearInterval(labelTimer);
      setIsGenerating(false);
      setProgressLabel("");
    }
  };

  const s = makeStyles(colors);

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: topPad + 16, paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          <View>
            <Text style={s.brandName}>Voyager.</Text>
          </View>
          <Text style={[s.tagline, { color: colors.mutedForeground }]}>
            {"Predictable paths\nfor unpredictable souls."}
          </Text>
        </View>

        {/* CITY INPUT */}
        <View style={[s.card, { shadowColor: colors.border }]}>
          <Text style={[s.cardLabel, { color: colors.mutedForeground }]}>TARGET CITY</Text>
          <View style={[s.inputRow, { borderColor: colors.border }]}>
            <Feather name="map-pin" size={16} color={colors.primary} style={{ marginRight: 8 }} />
            <TextInput
              style={[s.input, { color: colors.foreground }]}
              placeholder="e.g. Kyoto, Lisbon, Cape Town"
              placeholderTextColor={colors.mutedForeground}
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>
        </View>

        {/* DURATION */}
        <View style={[s.card, { shadowColor: colors.border }]}>
          <Text style={[s.cardLabel, { color: colors.mutedForeground }]}>DURATION</Text>
          <View style={s.dayRow}>
            {[1, 2, 3].map((d) => {
              const sel = tripDays === d;
              return (
                <TouchableOpacity
                  key={d}
                  style={[
                    s.dayBtn,
                    {
                      borderColor: colors.border,
                      backgroundColor: sel ? colors.primary : colors.card,
                      shadowColor: colors.border,
                    },
                  ]}
                  onPress={() => { Haptics.selectionAsync(); setTripDays(d); }}
                >
                  <Text style={[s.dayBtnNum, { color: sel ? "#fff" : colors.foreground }]}>{d}</Text>
                  <Text style={[s.dayBtnSub, { color: sel ? "rgba(255,255,255,0.7)" : colors.mutedForeground }]}>
                    {d === 1 ? "DAY" : "DAYS"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* INTERESTS */}
        <View style={[s.card, { shadowColor: colors.border }]}>
          <View style={s.cardHeaderRow}>
            <Text style={[s.cardLabel, { color: colors.mutedForeground }]}>INTERESTS</Text>
            <Text style={[s.mono, { color: colors.mutedForeground, fontSize: 10 }]}>
              {interests.length}/3 MAX
            </Text>
          </View>
          <View style={s.tagGrid}>
            {INTERESTS.map((item) => {
              const sel = interests.includes(item.value);
              const disabled = !sel && interests.length >= 3;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    s.tag,
                    {
                      borderColor: sel ? colors.teal : colors.border,
                      backgroundColor: sel ? colors.teal : colors.card,
                      opacity: disabled ? 0.4 : 1,
                      shadowColor: colors.border,
                    },
                  ]}
                  onPress={() => !disabled && toggleInterest(item.value)}
                >
                  <Text style={[s.tagText, { color: sel ? "#fff" : colors.foreground }]}>
                    {item.tag}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* PACE */}
        <View style={[s.card, { shadowColor: colors.border }]}>
          <Text style={[s.cardLabel, { color: colors.mutedForeground }]}>PACE CONSTRAINT</Text>
          <View style={s.paceCol}>
            {PACES.map((p) => {
              const sel = pace === p.value;
              return (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    s.paceRow,
                    {
                      borderColor: sel ? colors.primary : colors.border,
                      backgroundColor: sel ? "#FEF2E8" : "transparent",
                    },
                  ]}
                  onPress={() => { Haptics.selectionAsync(); setPace(p.value); }}
                >
                  <View style={[s.paceRadio, { borderColor: colors.border }]}>
                    {sel && <View style={[s.paceRadioDot, { backgroundColor: colors.primary }]} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.paceLabel, { color: colors.foreground }]}>{p.label}</Text>
                    <Text style={[s.mono, { color: colors.mutedForeground, fontSize: 10, marginTop: 1 }]}>
                      {p.sub}
                    </Text>
                  </View>
                  {sel && (
                    <Text style={[s.mono, { color: colors.primary, fontSize: 9 }]}>● ACTIVE</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* GENERATE BUTTON */}
        {isGenerating ? (
          <View style={[s.progressCard, { borderColor: colors.border, backgroundColor: colors.primary }]}>
            <ActivityIndicator color="#fff" style={{ marginBottom: 10 }} />
            <Text style={[s.mono, { color: "#fff", fontSize: 11 }]}>{progressLabel}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[s.generateBtn, { backgroundColor: colors.primary, borderColor: colors.border, shadowColor: colors.border }]}
            onPress={handleGenerate}
            activeOpacity={0.85}
          >
            <Feather name="zap" size={16} color="#fff" style={{ marginRight: 8 }} />
            <Text style={s.generateBtnText}>GENERATE ITINERARY</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    root: { flex: 1 },
    scroll: { paddingHorizontal: 20 },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      borderBottomWidth: 3,
      paddingBottom: 20,
      marginBottom: 20,
    },
    brandName: { fontFamily: "DMSerifDisplay_400Italic", fontSize: 40, color: "#451A03" },
    tagline: { fontFamily: "DMSerifDisplay_400Italic", fontSize: 14, textAlign: "right", lineHeight: 22 },
    card: {
      backgroundColor: "#FFFBEB",
      borderWidth: 2,
      borderColor: "#451A03",
      borderRadius: 4,
      padding: 16,
      marginBottom: 14,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
    },
    cardLabel: {
      fontFamily: "SpaceMono_700Bold",
      fontSize: 9,
      letterSpacing: 2,
      marginBottom: 12,
    },
    cardHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 2,
      borderRadius: 4,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: colors.background,
    },
    input: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 16, color: "#451A03" },
    dayRow: { flexDirection: "row", gap: 10 },
    dayBtn: {
      flex: 1,
      paddingVertical: 14,
      borderWidth: 2,
      borderRadius: 4,
      alignItems: "center",
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    dayBtnNum: { fontFamily: "DMSerifDisplay_400Regular", fontSize: 28 },
    dayBtnSub: { fontFamily: "SpaceMono_400Regular", fontSize: 8, letterSpacing: 1 },
    tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    tag: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderWidth: 2,
      borderRadius: 20,
      shadowOffset: { width: 2, height: 2 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
    tagText: { fontFamily: "SpaceMono_700Bold", fontSize: 10 },
    paceCol: { gap: 8 },
    paceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 2,
      borderRadius: 4,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    paceRadio: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
    },
    paceRadioDot: { width: 8, height: 8, borderRadius: 4 },
    paceLabel: { fontFamily: "SpaceMono_700Bold", fontSize: 12 },
    mono: { fontFamily: "SpaceMono_400Regular" },
    progressCard: {
      borderWidth: 2,
      borderRadius: 4,
      padding: 20,
      alignItems: "center",
      marginBottom: 4,
    },
    generateBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 18,
      borderWidth: 2,
      borderRadius: 4,
      shadowOffset: { width: 4, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 4,
      marginBottom: 4,
    },
    generateBtnText: { fontFamily: "SpaceMono_700Bold", fontSize: 13, color: "#fff", letterSpacing: 2 },
  });
}
