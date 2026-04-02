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
  ImageBackground,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";
import { useItinerary, TravelPace, UserInterest } from "@/context/ItineraryContext";

const INTERESTS: { value: UserInterest; label: string; icon: string }[] = [
  { value: "history", label: "History", icon: "book" },
  { value: "art", label: "Art", icon: "image" },
  { value: "food", label: "Food", icon: "coffee" },
  { value: "nature", label: "Nature", icon: "sun" },
  { value: "architecture", label: "Architecture", icon: "home" },
  { value: "nightlife", label: "Nightlife", icon: "moon" },
  { value: "shopping", label: "Shopping", icon: "shopping-bag" },
  { value: "sports", label: "Sports", icon: "activity" },
];

const PACES: { value: TravelPace; label: string; sub: string }[] = [
  { value: "relaxed", label: "Relaxed", sub: "2 activities/day" },
  { value: "standard", label: "Standard", sub: "3 activities/day" },
  { value: "packed", label: "Packed", sub: "4 activities/day" },
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

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const toggleInterest = (v: UserInterest) => {
    Haptics.selectionAsync();
    setInterests((prev) =>
      prev.includes(v) ? prev.filter((i) => i !== v) : prev.length < 3 ? [...prev, v] : prev
    );
  };

  const handleGenerate = async () => {
    if (!city.trim()) {
      Alert.alert("Missing City", "Please enter a city to visit.");
      return;
    }
    if (interests.length === 0) {
      Alert.alert("Missing Interests", "Please select at least one interest.");
      return;
    }

    setIsGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const res = await fetch(`${apiBase}/api/itinerary/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: city.trim(), tripDays, interests, pace }),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert("Error", data.error ?? "Failed to generate itinerary");
        return;
      }

      setCurrentItinerary(data);
      setTripInput({ city: city.trim(), tripDays, interests, pace });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push("/itinerary");
    } catch (err) {
      Alert.alert("Error", "Could not connect to server. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const styles = createStyles(colors);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topPad + 16, paddingBottom: Platform.OS === "web" ? 100 : 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
              <Feather name="map-pin" size={18} color="#fff" />
            </View>
            <Text style={[styles.logoText, { color: colors.primary }]}>Wandr</Text>
          </View>
          <Text style={[styles.headline, { color: colors.foreground }]}>
            Plan your perfect trip
          </Text>
          <Text style={[styles.subheadline, { color: colors.mutedForeground }]}>
            AI-powered itineraries in seconds
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Destination</Text>
          <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
            <Feather name="search" size={16} color={colors.mutedForeground} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.input, { color: colors.foreground }]}
              placeholder="Enter a city (e.g. Paris, Tokyo)"
              placeholderTextColor={colors.mutedForeground}
              value={city}
              onChangeText={setCity}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Trip Length</Text>
          <View style={styles.dayButtons}>
            {[1, 2, 3].map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  styles.dayBtn,
                  {
                    backgroundColor: tripDays === d ? colors.primary : colors.secondary,
                    borderColor: tripDays === d ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setTripDays(d);
                }}
              >
                <Text
                  style={[
                    styles.dayBtnText,
                    { color: tripDays === d ? "#fff" : colors.mutedForeground },
                  ]}
                >
                  {d} {d === 1 ? "day" : "days"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Interests</Text>
            <Text style={[styles.sectionHint, { color: colors.mutedForeground }]}>
              {interests.length}/3
            </Text>
          </View>
          <View style={styles.interestGrid}>
            {INTERESTS.map((item) => {
              const selected = interests.includes(item.value);
              const disabled = !selected && interests.length >= 3;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.interestChip,
                    {
                      backgroundColor: selected ? colors.accent : colors.secondary,
                      borderColor: selected ? colors.primary : colors.border,
                      opacity: disabled ? 0.5 : 1,
                    },
                  ]}
                  onPress={() => !disabled && toggleInterest(item.value)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={item.icon as any}
                    size={14}
                    color={selected ? colors.primary : colors.mutedForeground}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.interestText,
                      { color: selected ? colors.accentForeground : colors.mutedForeground },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.foreground }]}>Travel Pace</Text>
          <View style={styles.paceList}>
            {PACES.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.paceRow,
                  {
                    backgroundColor: pace === p.value ? colors.accent : "transparent",
                    borderColor: pace === p.value ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setPace(p.value);
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.paceLabel, { color: pace === p.value ? colors.primary : colors.foreground }]}>
                    {p.label}
                  </Text>
                  <Text style={[styles.paceSub, { color: colors.mutedForeground }]}>{p.sub}</Text>
                </View>
                {pace === p.value && (
                  <Feather name="check-circle" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.generateBtn,
            { backgroundColor: isGenerating ? colors.muted : colors.primary },
          ]}
          onPress={handleGenerate}
          disabled={isGenerating}
          activeOpacity={0.85}
        >
          {isGenerating ? (
            <View style={styles.generatingRow}>
              <ActivityIndicator color="#fff" size="small" style={{ marginRight: 10 }} />
              <Text style={styles.generateBtnText}>Generating your trip...</Text>
            </View>
          ) : (
            <View style={styles.generatingRow}>
              <Feather name="zap" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.generateBtnText}>Generate Itinerary</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20 },
    header: { marginBottom: 24 },
    logoRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
    logoCircle: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 8,
    },
    logoText: { fontSize: 20, fontFamily: "Inter_700Bold" },
    headline: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 4 },
    subheadline: { fontSize: 15, fontFamily: "Inter_400Regular" },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      marginBottom: 16,
    },
    sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    sectionLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 12 },
    sectionHint: { fontSize: 13, fontFamily: "Inter_400Regular" },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
    dayButtons: { flexDirection: "row", gap: 10 },
    dayBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1,
      alignItems: "center",
    },
    dayBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    interestGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    interestChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
    },
    interestText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    paceList: { gap: 8 },
    paceRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
    },
    paceLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
    paceSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
    generateBtn: {
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 8,
    },
    generatingRow: { flexDirection: "row", alignItems: "center" },
    generateBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold" },
  });
}
