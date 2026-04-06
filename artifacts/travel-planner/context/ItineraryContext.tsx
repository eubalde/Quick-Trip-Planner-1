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
  time?: string; // "HH:MM" in 24h format
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
  startDate?: string;
  endDate?: string;
}

export interface TripInput {
  city: string;
  tripDays: number;
  interests: UserInterest[];
  pace: TravelPace;
  startDate?: string;
  endDate?: string;
}

interface ItineraryContextType {
  currentItinerary: Itinerary | null;
  setCurrentItinerary: (i: Itinerary | null) => void;
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (v: boolean) => void;
  removeActivity: (day: number, activityId: string) => void;
  reorderActivity: (day: number, fromIdx: number, toIdx: number) => void;
  updateActivityTime: (day: number, activityId: string, time: string) => void;
  addActivity: (day: number, activity: Activity) => void;
  tripInput: TripInput | null;
  setTripInput: (i: TripInput | null) => void;
}

/** Assign sequential default times to activities that have no time set.
 *  Starts at 09:00, advances by duration + 30min travel buffer per activity. */
function assignDefaultTimes(days: DayPlan[]): DayPlan[] {
  return days.map((d) => {
    let totalMins = 9 * 60; // 09:00
    const activities = d.activities.map((a) => {
      if (a.time) { totalMins = timeToMins(a.time) + a.estimated_duration + 30; return a; }
      const t = minsToTime(totalMins);
      totalMins += a.estimated_duration + 30;
      return { ...a, time: t };
    });
    return { ...d, activities };
  });
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 9) * 60 + (m ?? 0);
}

function minsToTime(mins: number): string {
  const clamped = Math.min(Math.max(mins, 0), 23 * 60 + 59);
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const ItineraryContext = createContext<ItineraryContextType | null>(null);

const DRAFT_KEY = "itinerary_draft";

export function ItineraryProvider({ children }: { children: ReactNode }) {
  const [currentItinerary, _setCurrentItinerary] = useState<Itinerary | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [tripInput, setTripInput] = useState<TripInput | null>(null);

  const setCurrentItinerary = (i: Itinerary | null) => {
    const withTimes = i ? { ...i, days: assignDefaultTimes(i.days) } : null;
    _setCurrentItinerary(withTimes);
    setHasUnsavedChanges(false);
    if (withTimes) {
      AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(withTimes)).catch(() => {});
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

  const addActivity = (day: number, activity: Activity) => {
    if (!currentItinerary) return;
    const withTime = activity.time ? activity : { ...activity, time: minsToTime(9 * 60) };
    const updated: Itinerary = {
      ...currentItinerary,
      days: currentItinerary.days.map((d) =>
        d.day === day ? { ...d, activities: [...d.activities, withTime] } : d
      ),
    };
    _setCurrentItinerary(updated);
    setHasUnsavedChanges(true);
    AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(updated)).catch(() => {});
  };

  const updateActivityTime = (day: number, activityId: string, time: string) => {
    if (!currentItinerary) return;
    const updated: Itinerary = {
      ...currentItinerary,
      days: currentItinerary.days.map((d) =>
        d.day === day
          ? {
              ...d,
              activities: d.activities.map((a) =>
                a.id === activityId ? { ...a, time } : a
              ),
            }
          : d
      ),
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
        updateActivityTime,
        addActivity,
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
