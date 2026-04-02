import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
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

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const fetchItineraries = useCallback(async () => {
    if (!user || !token) return;
    setIsLoading(true);
    try {
      const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
      const res = await fetch(`${apiBase}/api/itinerary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItineraries(data.reverse());
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [user, token]);

  useFocusEffect(
    useCallback(() => {
      fetchItineraries();
    }, [fetchItineraries])
  );

  const handleOpen = (item: SavedItinerary) => {
    Haptics.selectionAsync();
    setCurrentItinerary({ ...item, generatedAt: item.createdAt } as Itinerary);
    router.push("/itinerary");
  };

  const handleDelete = (id: string, city: string) => {
    Alert.alert("Delete Itinerary", `Remove your trip to ${city}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setDeletingId(id);
          try {
            const apiBase = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
            await fetch(`${apiBase}/api/itinerary/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            setItineraries((prev) => prev.filter((i) => i.id !== id));
          } catch {
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const styles = createStyles(colors);

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 16 }]}>
          <Text style={[styles.title, { color: colors.foreground }]}>Saved Trips</Text>
        </View>
        <View style={styles.emptyState}>
          <Feather name="lock" size={48} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sign in to save trips</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Create an account to save and revisit your itineraries
          </Text>
          <TouchableOpacity
            style={[styles.authBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/auth")}
          >
            <Text style={styles.authBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Saved Trips</Text>
        {isLoading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      <FlatList
        data={itineraries}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Platform.OS === "web" ? 100 : 100 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={itineraries.length > 0}
        onRefresh={fetchItineraries}
        refreshing={isLoading}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyState}>
              <Feather name="bookmark" size={48} color={colors.border} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No saved trips yet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Generate a trip and save it to see it here
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => handleOpen(item)}
            activeOpacity={0.8}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.cityBadge, { backgroundColor: colors.accent }]}>
                <Feather name="map-pin" size={12} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.cityBadgeText, { color: colors.primary }]}>{item.city}</Text>
              </View>
              {item.isOptimized && (
                <View style={[styles.optimizedBadge, { backgroundColor: "#d1fae5" }]}>
                  <Text style={[styles.optimizedText, { color: "#065f46" }]}>Optimized</Text>
                </View>
              )}
            </View>
            <Text style={[styles.cardCity, { color: colors.foreground }]}>{item.city}</Text>
            <View style={styles.cardMeta}>
              <View style={styles.metaItem}>
                <Feather name="calendar" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {item.tripDays} {item.tripDays === 1 ? "day" : "days"}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Feather name="zap" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {item.pace}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Feather name="clock" size={13} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item.id, item.city)}
              disabled={deletingId === item.id}
            >
              {deletingId === item.id ? (
                <ActivityIndicator size="small" color={colors.destructive} />
              ) : (
                <Feather name="trash-2" size={16} color={colors.destructive} />
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    container: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingBottom: 16,
    },
    title: { fontSize: 26, fontFamily: "Inter_700Bold" },
    list: { paddingHorizontal: 20, paddingTop: 4 },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
      marginBottom: 12,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    cityBadge: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    cityBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
    optimizedBadge: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 20,
    },
    optimizedText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
    cardCity: { fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 8 },
    cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
    deleteBtn: { position: "absolute", top: 16, right: 16, padding: 4 },
    emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 80, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 20, fontFamily: "Inter_600SemiBold", marginTop: 16, marginBottom: 8, textAlign: "center" },
    emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
    authBtn: {
      marginTop: 24,
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: 12,
    },
    authBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  });
}
