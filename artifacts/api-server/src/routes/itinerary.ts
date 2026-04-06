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

router.post("/itinerary/generate", async (req, res) => {
  const { city, tripDays, interests, pace, seed } = req.body as {
    city: string;
    tripDays: number;
    interests: string[];
    pace: string;
    seed?: number;
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
  const totalNeeded = activitiesPerDay * tripDays;
  const candidateCount = Math.max(20, totalNeeded * 3);

  const systemPrompt = `You are a travel expert. Generate exactly ${candidateCount} distinct tourist activities for ${city}.
Return ONLY a valid JSON array. Each activity must have these exact fields:
- id: unique string like "act_1"
- name: string (specific real place name)
- category: one of: museum, landmark, park, restaurant, shopping, entertainment, cultural, outdoor, nightlife, tour
- estimated_duration: integer (minutes, 30-180)
- description: string (2-3 sentences about the place)
- address: string (approximate address or neighborhood)
- lat: number (approximate latitude)
- lng: number (approximate longitude)

IMPORTANT: Return ONLY the JSON array, no other text.`;

  const userPrompt = `Generate ${candidateCount} tourist activities for ${city}. 
Focus particularly on these interest areas: ${interests.join(", ")}.
Make activities varied and representative of the city's best attractions.
Include a mix of: ${Object.keys(CATEGORY_POPULARITY).join(", ")}.`;

  let candidates: Array<{
    id: string;
    name: string;
    category: string;
    estimated_duration: number;
    description: string;
    address: string;
    lat: number;
    lng: number;
  }> = [];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "[]";
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      candidates = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    req.log.error({ err }, "AI generation failed");
    res.status(500).json({ error: "Failed to generate itinerary" });
    return;
  }

  if (!Array.isArray(candidates) || candidates.length === 0) {
    res.status(500).json({ error: "Failed to parse AI response" });
    return;
  }

  const usedCategories = new Set<string>();
  const scored = candidates.map((a) => ({
    ...a,
    score: scoreActivity(a, interests, usedCategories),
  }));

  scored.sort((a, b) => b.score - a.score);

  const seededRandom = seed
    ? (() => {
        let s = seed;
        return () => {
          s = (s * 1103515245 + 12345) & 0x7fffffff;
          return s / 0x7fffffff;
        };
      })()
    : Math.random;

  const days: Array<{ day: number; activities: typeof scored }> = [];

  let fallbackTier: number | null = null;

  for (let d = 0; d < tripDays; d++) {
    const usedIds = new Set(days.flatMap((day) => day.activities.map((a) => a.id)));
    let available = scored.filter((a) => !usedIds.has(a.id));

    if (available.length < activitiesPerDay) {
      if (fallbackTier === null) fallbackTier = 1;
      const extras = scored.filter((a) => !usedIds.has(a.id));
      available = extras.length > 0 ? extras : scored.slice(0, activitiesPerDay);
    }

    const topPool = available.slice(0, Math.min(10, available.length));

    let selected: typeof scored;
    if (seed !== undefined) {
      selected = [];
      const pool = [...topPool];
      const needed = Math.min(activitiesPerDay, pool.length);
      for (let i = 0; i < needed; i++) {
        const idx = Math.floor(seededRandom() * pool.length);
        selected.push(pool.splice(idx, 1)[0]!);
      }
    } else {
      selected = topPool.slice(0, activitiesPerDay);
    }

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
