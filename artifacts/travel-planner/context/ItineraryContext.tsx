import React, { createContext, useContext, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ActivityCategory =
  | "museum"
  | "landmark"
  | "park"
  | "restaurant"
  | "shopping"
  | "entertainment"
  | "cultural"
  | "outdoor"
  | "nightlife"
  | "tour";

export type TravelPace = "relaxed" | "standard" | "packed";

export type UserInterest =
  | "history"
  | "art"
  | "food"
  | "nature"
  | "architecture"
  | "nightlife"
  | "shopping"
  | "sports";

export interface Activity {
  id: string;
  name: string;
  category: ActivityCategory;
  estimated_duration: number;
  description: string;
  address?: string;
  lat?: number;
  lng?: number;
  score?: number;
}

export interface DayPlan {
  day: number;
  activities: Activity[];
}

export interface Itinerary {
  city: string;
  tripDays: number;
  pace: TravelPace;
  interests: UserInterest[];
  days: DayPlan[];
  isOptimized: boolean;
  generatedAt?: string;
  id?: string;
}

export interface TripInput {
  city: string;
  tripDays: number;
  interests: UserInterest[];
  pace: TravelPace;
}

interface ItineraryContextType {
  currentItinerary: Itinerary | null;
  setCurrentItinerary: (i: Itinerary | null) => void;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (v: boolean) => void;
  removeActivity: (day: number, activityId: string) => void;
  reorderActivity: (day: number, fromIdx: number, toIdx: number) => void;
  tripInput: TripInput | null;
  setTripInput: (i: TripInput | null) => void;
}

const ItineraryContext = createContext<ItineraryContextType | null>(null);

const DRAFT_KEY = "itinerary_draft";

export function ItineraryProvider({ children }: { children: ReactNode }) {
  const [currentItinerary, _setCurrentItinerary] = useState<Itinerary | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [tripInput, setTripInput] = useState<TripInput | null>(null);

  const setCurrentItinerary = (i: Itinerary | null) => {
    _setCurrentItinerary(i);
    setHasUnsavedChanges(false);
    if (i) {
      AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(i)).catch(() => {});
    } else {
      AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
    }
  };

  const removeActivity = (day: number, activityId: string) => {
    if (!currentItinerary) return;
    const updated: Itinerary = {
      ...currentItinerary,
      isOptimized: false,
      days: currentItinerary.days.map((d) =>
        d.day === day
          ? { ...d, activities: d.activities.filter((a) => a.id !== activityId) }
          : d
      ),
    };
    _setCurrentItinerary(updated);
    setHasUnsavedChanges(true);
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(updated)).catch(() => {});
  };

  const reorderActivity = (day: number, fromIdx: number, toIdx: number) => {
    if (!currentItinerary) return;
    const updated: Itinerary = {
      ...currentItinerary,
      isOptimized: false,
      days: currentItinerary.days.map((d) => {
        if (d.day !== day) return d;
        const acts = [...d.activities];
        const [moved] = acts.splice(fromIdx, 1);
        if (moved) acts.splice(toIdx, 0, moved);
        return { ...d, activities: acts };
      }),
    };
    _setCurrentItinerary(updated);
    setHasUnsavedChanges(true);
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(updated)).catch(() => {});
  };

  return (
    <ItineraryContext.Provider
      value={{
        currentItinerary,
        setCurrentItinerary,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        removeActivity,
        reorderActivity,
        tripInput,
        setTripInput,
      }}
    >
      {children}
    </ItineraryContext.Provider>
  );
}

export function useItinerary() {
  const ctx = useContext(ItineraryContext);
  if (!ctx) throw new Error("useItinerary must be used within ItineraryProvider");
  return ctx;
}
