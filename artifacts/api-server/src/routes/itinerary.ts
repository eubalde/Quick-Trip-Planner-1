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

/** Generic/vague name patterns that signal fabricated entries */
const HALLUCINATION_NAME_PATTERNS = [
  /^(a |the )?(local|traditional|famous|popular|authentic|classic|historic)\s/i,
  /^(hidden gem|must.?see|top attraction)/i,
  /\b(unnamed|unknown|various|multiple)\b/i,
  /^(restaurant|bar|cafe|shop|market|museum|park|gallery)$/i,
];

/** Remove activities that are likely hallucinated or too vague to be real */
function filterHallucinations(
  activities: ActivityCandidate[],
  city: string
): ActivityCandidate[] {
  // Step 1: Drop generic/vague names
  const nameFiltered = activities.filter((a) => {
    const name = (a.name ?? "").trim();
    if (name.length < 3) return false;
    if (HALLUCINATION_NAME_PATTERNS.some((re) => re.test(name))) return false;
    return true;
  });

  if (nameFiltered.length === 0) return activities; // nothing passed — keep originals as fallback

  // Step 2: Coordinate outlier removal — activities should cluster in the same city.
  // Compute median lat/lng; discard anything more than 0.8 degrees away.
  const lats = nameFiltered.map((a) => a.lat).filter((v) => typeof v === "number" && !isNaN(v));
  const lngs = nameFiltered.map((a) => a.lng).filter((v) => typeof v === "number" && !isNaN(v));

  if (lats.length === 0) return nameFiltered;

  const sorted = (arr: number[]) => [...arr].sort((a, b) => a - b);
  const median = (arr: number[]) => {
    const s = sorted(arr);
    const m = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[m - 1]! + s[m]!) / 2 : s[m]!;
  };

  const medLat = median(lats);
  const medLng = median(lngs);
  const MAX_DELTA = 0.8; // ~90km — generous enough for any real city

  const coordFiltered = nameFiltered.filter((a) => {
    if (typeof a.lat !== "number" || typeof a.lng !== "number") return false;
    return Math.abs(a.lat - medLat) <= MAX_DELTA && Math.abs(a.lng - medLng) <= MAX_DELTA;
  });

  return coordFiltered.length >= 1 ? coordFiltered : nameFiltered;
}

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

  const diversityLines = allowedCats
    .filter((c) => CATEGORY_DIVERSITY_HINTS[c])
    .map((c) => `  • ${c}: ${CATEGORY_DIVERSITY_HINTS[c]}`)
    .join("\n");

  const systemPrompt =
    `You are a verified travel data specialist. Your sole job is to output real, factually accurate venue data. ` +
    `ACCURACY IS MORE IMPORTANT THAN QUANTITY. ` +
    `Generate up to ${count} tourist activities in ${city} — only include venues you are highly confident exist there based on your training data. ` +
    `If you are uncertain whether a venue exists, its name is correct, or its address is accurate, OMIT IT ENTIRELY. ` +
    `Return ONLY a valid JSON array. Each object must have exactly: ` +
    `"id" ("d${dayNum}_N"), "name" (exact real venue name as publicly known), ` +
    `"category" (MUST be one of: ${allowedCats.join(", ")}), ` +
    `"estimated_duration" (integer minutes, 30–180), ` +
    `"description" (factual 1–2 sentences — no superlatives or marketing language), ` +
    `"address" (real street address or well-known neighbourhood in ${city}), ` +
    `"lat" (accurate latitude), "lng" (accurate longitude). ` +
    `Return ONLY the JSON array, no other text.`;

  const userPrompt =
    `Day ${dayNum}/${tripDays} in ${city}. Interests: ${interests.join(", ")}. Today's focus: ${focusInterest}.\n\n` +
    `DATA INTEGRITY RULES — all are mandatory:\n` +
    `1. REAL VENUES ONLY: every entry must be a venue you have verified knowledge of. If uncertain → omit.\n` +
    `2. EXACT NAMES: use the official public name (e.g. "Tsukiji Outer Market", not "Tsukiji fish market"). No nicknames or invented names.\n` +
    `3. ACCURATE ADDRESSES: use the correct street address or neighbourhood. Do not guess.\n` +
    `4. ACCURATE COORDINATES: lat/lng must place the venue in ${city}. Do not use placeholder or city-centre coordinates.\n` +
    `5. CATEGORY CONSTRAINT: category must be one of [${allowedCats.join(", ")}] — no exceptions.\n` +
    `6. INTEREST RELEVANCE: all picks must relate to ${interests.join(", ")}.\n` +
    `7. SUB-TYPE DIVERSITY (important — vary within each category):\n${diversityLines}\n` +
    `8. GEOGRAPHIC SPREAD: picks should span different neighbourhoods of ${city}, not cluster in one area.\n` +
    `9. NO FABRICATION: do not invent venue names, composite venues, or fictional addresses under any circumstances.\n` +
    `Return ONLY the JSON array. It is acceptable to return fewer than ${count} entries if you cannot verify enough real venues.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_completion_tokens: 3000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? "[]";
    const match = content.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const raw = JSON.parse(match[0]) as ActivityCandidate[];
    return filterHallucinations(raw, city);
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
