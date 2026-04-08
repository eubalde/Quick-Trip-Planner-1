import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db } from "@workspace/db";
import { itinerariesTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

const ACTIVITY_COUNTS: Record<string, number> = {
  relaxed: 2,
  standard: 3,
  packed: 4,
};

const CATEGORY_POPULARITY: Record<string, number> = {
  museum: 0.85,
  landmark: 0.95,
  park: 0.75,
  restaurant: 0.80,
  shopping: 0.65,
  entertainment: 0.70,
  cultural: 0.80,
  outdoor: 0.72,
  nightlife: 0.60,
  tour: 0.78,
};

const INTEREST_CATEGORY_MAP: Record<string, string[]> = {
  history: ["museum", "landmark", "cultural", "tour"],
  art: ["museum", "cultural", "entertainment"],
  food: ["restaurant", "cultural", "tour"],
  nature: ["park", "outdoor", "landmark"],
  architecture: ["landmark", "cultural", "tour"],
  nightlife: ["nightlife", "entertainment", "restaurant"],
  shopping: ["shopping", "entertainment"],
  sports: ["outdoor", "park", "entertainment"],
};

function scoreActivity(
  activity: { category: string },
  interests: string[],
  usedCategories: Set<string>
): number {
  const interestMatch = interests.some((interest) =>
    (INTEREST_CATEGORY_MAP[interest] ?? []).includes(activity.category)
  )
    ? 1
    : 0;

  const categoryPopularity = CATEGORY_POPULARITY[activity.category] ?? 0.5;
  const diversityBonus = !usedCategories.has(activity.category) ? 0.1 : 0;

  return interestMatch * 0.6 + categoryPopularity * 0.3 + diversityBonus * 0.1;
}

function nearestNeighborSequence<T extends { lat?: number; lng?: number }>(
  activities: T[]
): T[] {
  if (activities.length <= 1) return activities;

  const remaining = [...activities];
  const result: T[] = [remaining.splice(0, 1)[0]!];

  while (remaining.length > 0) {
    const last = result[result.length - 1]!;
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const a = remaining[i]!;
      const dlat = (a.lat ?? 0) - (last.lat ?? 0);
      const dlng = (a.lng ?? 0) - (last.lng ?? 0);
      const dist = Math.sqrt(dlat * dlat + dlng * dlng);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    result.push(remaining.splice(bestIdx, 1)[0]!);
  }

  return result;
}

type ActivityCandidate = {
  id: string;
  name: string;
  category: string;
  estimated_duration: number;
  description: string;
  address: string;
  lat: number;
  lng: number;
};

async function generateDayActivities(
  city: string,
  dayNum: number,
  tripDays: number,
  interests: string[],
  pace: string,
  count: number,
  log: { error: (obj: object, msg: string) => void }
): Promise<ActivityCandidate[]> {
  const interestHints = interests
    .map((i) => `${i} (${(INTEREST_CATEGORY_MAP[i] ?? []).join(", ")})`)
    .join("; ");

  const focusInterest = interests[(dayNum - 1) % interests.length] ?? interests[0]!;
  const focusCats = (INTEREST_CATEGORY_MAP[focusInterest] ?? []).join(", ");

  const systemPrompt =
    `You are a travel expert. Generate exactly ${count} tourist activities in ${city} for day ${dayNum} of a ${tripDays}-day trip. ` +
    `Return ONLY a valid JSON array. Each object must have: ` +
    `"id" (string, e.g. "d${dayNum}_1"), "name" (specific real place name), ` +
    `"category" (one of: museum, landmark, park, restaurant, shopping, entertainment, cultural, outdoor, nightlife, tour), ` +
    `"estimated_duration" (integer minutes, 30–180), "description" (1–2 sentences), ` +
    `"address" (neighbourhood or street in ${city}), "lat" (number), "lng" (number). ` +
    `No extra fields. Return ONLY the JSON array.`;

  const userPrompt =
    `Day ${dayNum}/${tripDays} in ${city}. Interests: ${interestHints}. Today's focus: ${focusInterest} (${focusCats}).\n` +
    `Rules:\n` +
    `1. Use real, specific place names — not generic descriptions.\n` +
    `2. Spread picks across different neighbourhoods/areas of ${city}.\n` +
    `3. Mix 2–3 interest-aligned spots with 1–2 hidden gems or local favourites.\n` +
    `4. Vary duration: quick stops (30–45 min) and immersive experiences (90–180 min).\n` +
    `5. Every pick must be distinct and genuinely worth visiting.\n` +
    `Return ONLY the JSON array.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_completion_tokens: 2500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "[]";
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return [];
    return JSON.parse(match[0]) as ActivityCandidate[];
  } catch (err) {
    log.error({ err }, `Day ${dayNum} generation failed`);
    return [];
  }
}

router.post("/itinerary/generate", async (req, res) => {
  const { city, tripDays, interests, pace } = req.body as {
    city: string;
    tripDays: number;
    interests: string[];
    pace: string;
  };

  if (!city || !tripDays || !interests || !pace) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (tripDays < 1 || tripDays > 7) {
    res.status(400).json({ error: "Trip length must be 1-7 days" });
    return;
  }

  if (interests.length === 0 || interests.length > 3) {
    res.status(400).json({ error: "Select 1-3 interests" });
    return;
  }

  const activitiesPerDay = ACTIVITY_COUNTS[pace] ?? 3;
  const bufferCount = activitiesPerDay + 5;

  // All days generated in parallel — total time ≈ time of one call
  let dayResults: ActivityCandidate[][];
  try {
    dayResults = await Promise.all(
      Array.from({ length: tripDays }, (_, i) =>
        generateDayActivities(city, i + 1, tripDays, interests, pace, bufferCount, req.log)
      )
    );
  } catch (err) {
    req.log.error({ err }, "Parallel generation failed");
    res.status(500).json({ error: "Failed to generate itinerary" });
    return;
  }

  const allUsedNames = new Set<string>();
  const days: Array<{ day: number; activities: ActivityCandidate[] }> = [];
  let fallbackTier: number | null = null;

  for (let d = 0; d < tripDays; d++) {
    const raw = dayResults[d] ?? [];

    if (raw.length === 0) {
      fallbackTier = 1;
    }

    // Remove cross-day name duplicates
    const unique = raw.filter((a) => {
      const key = (a.name ?? "").toLowerCase().trim();
      return key.length > 0 && !allUsedNames.has(key);
    });

    const pool = unique.length >= activitiesPerDay ? unique : raw;

    const usedCategories = new Set<string>();
    const scored = pool.map((a) => ({
      ...a,
      score: scoreActivity(a, interests, usedCategories),
    }));
    scored.sort((a, b) => b.score - a.score);

    const selected = scored.slice(0, activitiesPerDay);
    selected.forEach((a) => allUsedNames.add((a.name ?? "").toLowerCase().trim()));

    const sequenced = nearestNeighborSequence(selected);
    days.push({ day: d + 1, activities: sequenced });
  }

  res.json({
    city,
    tripDays,
    pace,
    interests,
    days,
    isOptimized: true,
    fallbackTier,
    generatedAt: new Date().toISOString(),
  });
});

router.get("/itinerary", async (req, res) => {
  const userId = (req as { userId?: string }).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const itineraries = await db
    .select()
    .from(itinerariesTable)
    .where(eq(itinerariesTable.userId, userId))
    .orderBy(itinerariesTable.createdAt);

  res.json(itineraries);
});

router.post("/itinerary", async (req, res) => {
  const userId = (req as { userId?: string }).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { city, tripDays, pace, interests, days, isOptimized } = req.body;

  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);

  const [itinerary] = await db
    .insert(itinerariesTable)
    .values({
      id,
      userId,
      city,
      tripDays,
      pace,
      interests,
      days,
      isOptimized,
    })
    .returning();

  res.json(itinerary);
});

router.get("/itinerary/:id", async (req, res) => {
  const userId = (req as { userId?: string }).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { id } = req.params;
  const [itinerary] = await db
    .select()
    .from(itinerariesTable)
    .where(and(eq(itinerariesTable.id, id!), eq(itinerariesTable.userId, userId)));

  if (!itinerary) {
    res.status(404).json({ error: "Itinerary not found" });
    return;
  }

  res.json(itinerary);
});

router.delete("/itinerary/:id", async (req, res) => {
  const userId = (req as { userId?: string }).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { id } = req.params;
  const [deleted] = await db
    .delete(itinerariesTable)
    .where(and(eq(itinerariesTable.id, id!), eq(itinerariesTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Itinerary not found" });
    return;
  }

  res.json({ message: "Deleted successfully" });
});

export default router;
