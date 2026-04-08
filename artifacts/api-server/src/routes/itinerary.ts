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
  food: ["restaurant", "cultural"],
  nature: ["park", "outdoor", "landmark"],
  architecture: ["landmark", "cultural", "tour"],
  nightlife: ["nightlife", "entertainment", "restaurant"],
  shopping: ["shopping", "entertainment"],
  sports: ["outdoor", "park", "entertainment"],
};

/** Per-category guidance so the AI generates varied sub-types, not just the generic default */
const CATEGORY_DIVERSITY_HINTS: Record<string, string> = {
  restaurant:
    "Vary widely: street-food stalls, local hawker centres, traditional home-cooking spots, hole-in-the-wall joints, specialty cuisine (e.g. seafood, BBQ, dumplings), casual neighbourhood cafes, bustling food courts, and fine-dining restaurants. AVOID generic chain restaurants.",
  nightlife:
    "Vary widely: live-music venues (jazz, blues, rock), rooftop bars, speakeasies, night markets, wine bars, cocktail lounges, comedy clubs, izakayas/tapas bars, late-night dessert spots. AVOID generic 'nightclub' or 'bar' entries.",
  shopping:
    "Vary widely: open-air street markets, antique/vintage shops, local artisan boutiques, independent bookshops, craft stores, specialty food shops, night bazaars, designer districts, flea markets. AVOID generic 'shopping mall' entries.",
  museum:
    "Vary: major national museums, small specialist museums (photography, ceramics, literature), interactive science centres, art galleries (contemporary and classical), living-history sites.",
  park:
    "Vary: large city parks, botanical gardens, rooftop gardens, hilltop viewpoints with trails, riverfront promenades, hidden pocket parks.",
  outdoor:
    "Vary: hiking trails, cycling routes, kayaking/paddleboarding spots, scenic viewpoints, coastal walks, wildlife parks.",
  cultural:
    "Vary: traditional performance venues, religious/historical sites, neighbourhood heritage walks, artisan workshops, community cultural centres.",
  landmark:
    "Vary: iconic skyline landmarks, lesser-known architectural gems, bridges, plazas, historic gates or towers, panoramic observation points.",
  entertainment:
    "Vary: live theatre, comedy clubs, escape rooms, cinema palaces, game arcades, sports arenas, concert halls.",
  tour:
    "Vary: walking street-art tours, boat/river tours, food-tasting tours, cycling city tours, historical ghost tours, neighbourhood deep-dive tours.",
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
  const allowedCats = [
    ...new Set(interests.flatMap((i) => INTEREST_CATEGORY_MAP[i] ?? [])),
  ];

  const focusInterest = interests[(dayNum - 1) % interests.length] ?? interests[0]!;

  // Build sub-type diversity guidance for every allowed category
  const diversityLines = allowedCats
    .filter((c) => CATEGORY_DIVERSITY_HINTS[c])
    .map((c) => `  • ${c}: ${CATEGORY_DIVERSITY_HINTS[c]}`)
    .join("\n");

  const systemPrompt =
    `You are a travel expert generating real, specific, diverse tourist activities. ` +
    `Generate exactly ${count} activities in ${city} for day ${dayNum} of a ${tripDays}-day trip. ` +
    `Return ONLY a valid JSON array. Each object must have exactly: ` +
    `"id" ("d${dayNum}_N"), "name" (real specific venue/place name), ` +
    `"category" (MUST be one of: ${allowedCats.join(", ")}), ` +
    `"estimated_duration" (integer minutes, 30–180), "description" (1–2 sentences), ` +
    `"address" (street or neighbourhood in ${city}), "lat" (number), "lng" (number). ` +
    `Return ONLY the JSON array, no other text.`;

  const userPrompt =
    `Day ${dayNum}/${tripDays} in ${city}. Interests: ${interests.join(", ")}. Today's focus: ${focusInterest}.\n\n` +
    `MANDATORY RULES:\n` +
    `1. Category must be one of: [${allowedCats.join(", ")}] — no exceptions.\n` +
    `2. Every name must be a REAL, specific venue (e.g. "Tsukiji Outer Market", not "local market").\n` +
    `3. Spread picks across DIFFERENT neighbourhoods/districts of ${city} — no clustering in one area.\n` +
    `4. Generate genuinely DIVERSE sub-types within each category:\n` +
    `${diversityLines}\n` +
    `5. Do NOT repeat any place that would obviously appear in another day (be creative).\n` +
    `6. Include both quick stops (30–45 min) and deep-dive experiences (90–180 min).\n` +
    `7. All picks must be directly relevant to: ${interests.join(", ")}.\n` +
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
  // Triple buffer so after cross-day global dedup each day still has enough candidates
  const bufferPerDay = activitiesPerDay * 3 + 3;

  // Hard category allowlist from selected interests
  const allowedCategories = new Set(
    interests.flatMap((i) => INTEREST_CATEGORY_MAP[i] ?? [])
  );

  // Phase 1: All days generated in parallel
  let dayResults: ActivityCandidate[][];
  try {
    dayResults = await Promise.all(
      Array.from({ length: tripDays }, (_, i) =>
        generateDayActivities(city, i + 1, tripDays, interests, pace, bufferPerDay, req.log)
      )
    );
  } catch (err) {
    req.log.error({ err }, "Parallel generation failed");
    res.status(500).json({ error: "Failed to generate itinerary" });
    return;
  }

  // Phase 2: Build a single global pool — deduplicate by exact name across all days
  const seenNames = new Set<string>();
  const globalPool: ActivityCandidate[] = [];
  for (const dayResult of dayResults) {
    for (const a of dayResult) {
      const key = (a.name ?? "").toLowerCase().trim();
      if (key.length > 0 && !seenNames.has(key)) {
        seenNames.add(key);
        globalPool.push(a);
      }
    }
  }

  // Phase 3: Hard-filter by interest-aligned categories; fall back to full pool only if needed
  const interestAligned = globalPool.filter((a) => allowedCategories.has(a.category));
  const filteredPool = interestAligned.length >= activitiesPerDay * tripDays
    ? interestAligned
    : globalPool;

  // Phase 4: Score globally with a random jitter so the same city + interests
  // doesn't produce the exact same sorted order every time.
  // Jitter of ±0.12 is large enough to vary ordering within a tier but small
  // enough that genuinely better activities still tend to surface first.
  const globalUsedCats = new Set<string>();
  const scored = filteredPool.map((a) => ({
    ...a,
    score: scoreActivity(a, interests, globalUsedCats) + (Math.random() * 0.24 - 0.12),
  }));
  scored.sort((a, b) => b.score - a.score);

  // Phase 5: Round-robin distribution across days
  const dayBuckets: typeof scored[] = Array.from({ length: tripDays }, () => []);
  scored.forEach((a, i) => {
    const dayIdx = i % tripDays;
    if ((dayBuckets[dayIdx]?.length ?? 0) < activitiesPerDay) {
      dayBuckets[dayIdx]!.push(a);
    }
  });

  const fallbackTier: number | null = dayBuckets.some((b) => b.length < activitiesPerDay)
    ? 1
    : null;

  // Phase 6: Shuffle each day's bucket before routing so the nearest-neighbour
  // start point also varies — otherwise the first element is always the same.
  function shuffleArray<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
    }
    return arr;
  }

  const days = dayBuckets.map((bucket, i) => ({
    day: i + 1,
    activities: nearestNeighborSequence(shuffleArray(bucket)),
  }));

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
