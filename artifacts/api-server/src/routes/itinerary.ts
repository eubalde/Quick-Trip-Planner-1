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
  confidence?: "high" | "medium" | "low";
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
    `You are a verified travel data specialist. Your sole job is to output real, factually accurate, maximally diverse venue data. ` +
    `ACCURACY AND VARIETY are equally important. ` +
    `Generate up to ${count} tourist activities in ${city}. ` +
    `Return ONLY a valid JSON array. Each object must have exactly these fields: ` +
    `"id" ("d${dayNum}_N"), "name" (exact real venue name as publicly known), ` +
    `"category" (MUST be one of: ${allowedCats.join(", ")}), ` +
    `"estimated_duration" (integer minutes, 30–180), ` +
    `"description" (factual 1–2 sentences — no superlatives), ` +
    `"address" (real street address or well-known neighbourhood in ${city}), ` +
    `"lat" (accurate latitude), "lng" (accurate longitude), ` +
    `"confidence" ("high" | "medium" | "low" — your certainty this venue is real and currently operating). ` +
    `Confidence guide: ` +
    `"high" = nationally recognised institution, major government museum, iconic landmark — virtually certain to be open; ` +
    `"medium" = well-established independent venue with strong public profile, likely still operating; ` +
    `"low" = newer, boutique, or uncertain — not fully confident it is still open. ` +
    `Return ONLY the JSON array, no other text.`;

  const usedCatsDisplay = allowedCats.join(", ");
  const userPrompt =
    `Day ${dayNum}/${tripDays} in ${city}. Interests: ${interests.join(", ")}. Today's focus: ${focusInterest}.\n\n` +
    `DATA INTEGRITY — mandatory:\n` +
    `1. REAL VENUES ONLY: every entry must be a venue you have clear knowledge of in ${city}. Uncertain → omit.\n` +
    `2. OPERATING STATUS: prefer venues continuously operating for many years, very unlikely to have closed.\n` +
    `3. EXACT NAMES: use the official public name. No invented or composite names.\n` +
    `4. ACCURATE ADDRESSES: real street address or neighbourhood. Do not guess.\n` +
    `5. ACCURATE COORDINATES: lat/lng must correctly place the venue in ${city}. No city-centre placeholders.\n` +
    `6. CONFIDENCE REQUIRED: every entry must include a "confidence" field.\n` +
    `7. CATEGORY CONSTRAINT: category must be one of [${usedCatsDisplay}] — no exceptions.\n` +
    `8. INTEREST RELEVANCE: all picks must relate to ${interests.join(", ")}.\n\n` +
    `DIVERSITY — also mandatory:\n` +
    `9. NO TWO ENTRIES may be the same type of experience. If you include a natural history museum, the next museum must be a completely different type (contemporary art, science, living-history, etc.).\n` +
    `10. MIX SETTINGS: alternate indoor and outdoor venues. Mix daytime and evening-appropriate activities. Mix active (walking, exploring) and contemplative (sitting, observing).\n` +
    `11. SUB-TYPE DIVERSITY within each category:\n${diversityLines}\n` +
    `12. GEOGRAPHIC SPREAD: span at least ${Math.min(3, count)} distinct neighbourhoods of ${city}. No clustering.\n` +
    `13. NO FABRICATION: do not invent venue names, composite venues, or fictional addresses.\n` +
    `Fewer than ${count} entries is fine — quality and variety over quantity.`;

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
    const dehalluced = filterHallucinations(raw, city);
    // Drop low-confidence entries; fall back to full set only if nothing passes
    const confident = dehalluced.filter((a) => a.confidence !== "low");
    return confident.length >= 1 ? confident : dehalluced;
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

  // Phase 2: Build a global pool with fuzzy name deduplication across all days.
  // Normalize: lowercase, strip leading articles, remove punctuation, first 20 chars.
  function normalizeName(name: string): string {
    return (name ?? "")
      .toLowerCase()
      .replace(/^(the|a|an)\s+/i, "")
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 20);
  }
  const seenKeys = new Set<string>();
  const globalPool: ActivityCandidate[] = [];
  for (const dayResult of dayResults) {
    for (const a of dayResult) {
      const key = normalizeName(a.name);
      if (key.length > 2 && !seenKeys.has(key)) {
        seenKeys.add(key);
        globalPool.push(a);
      }
    }
  }

  // Phase 3: Hard-filter by interest-aligned categories; fall back to full pool only if needed
  const interestAligned = globalPool.filter((a) => allowedCategories.has(a.category));
  const filteredPool = interestAligned.length >= activitiesPerDay * tripDays
    ? interestAligned
    : globalPool;

  // Phase 4: Score globally with random jitter for variety
  const globalUsedCats = new Set<string>();
  const scored = filteredPool.map((a) => ({
    ...a,
    score: scoreActivity(a, interests, globalUsedCats) + (Math.random() * 0.24 - 0.12),
  }));
  scored.sort((a, b) => b.score - a.score);

  // Phase 5: Diversity-aware distribution — prevent category clustering within each day.
  // maxPerCatPerDay caps how many activities of the same category can appear in one day.
  // Two passes: first enforce the cap, then fill remaining slots without restriction.
  const numAllowedCats = Math.max(allowedCategories.size, 1);
  const maxPerCatPerDay = Math.max(1, Math.ceil(activitiesPerDay / numAllowedCats));

  const placed = new Set<(typeof scored)[0]>();
  const dayBuckets: typeof scored[] = Array.from({ length: tripDays }, () => []);
  const dayCatCounts: Map<string, number>[] = Array.from({ length: tripDays }, () => new Map());

  function tryPlace(a: (typeof scored)[0], enforceCap: boolean): boolean {
    let bestDay = -1;
    let bestCatCount = Infinity;
    let bestTotalCount = Infinity;
    for (let d = 0; d < tripDays; d++) {
      const bucket = dayBuckets[d]!;
      if (bucket.length >= activitiesPerDay) continue;
      const catCount = dayCatCounts[d]!.get(a.category) ?? 0;
      if (enforceCap && catCount >= maxPerCatPerDay) continue;
      if (catCount < bestCatCount || (catCount === bestCatCount && bucket.length < bestTotalCount)) {
        bestDay = d;
        bestCatCount = catCount;
        bestTotalCount = bucket.length;
      }
    }
    if (bestDay < 0) return false;
    dayBuckets[bestDay]!.push(a);
    const curr = dayCatCounts[bestDay]!.get(a.category) ?? 0;
    dayCatCounts[bestDay]!.set(a.category, curr + 1);
    placed.add(a);
    return true;
  }

  // Pass 1: diversity-enforced fill
  for (const a of scored) { if (!placed.has(a)) tryPlace(a, true); }
  // Pass 2: fill remaining slots without category cap
  for (const a of scored) { if (!placed.has(a)) tryPlace(a, false); }

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
    // Strip the internal `confidence` field before sending to the client
    activities: nearestNeighborSequence(shuffleArray(bucket)).map(
      ({ confidence: _c, ...rest }) => rest
    ),
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

router.patch("/itinerary/:id", async (req, res) => {
  const userId = (req as { userId?: string }).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { id } = req.params;
  const { name } = req.body as { name?: string };

  const [updated] = await db
    .update(itinerariesTable)
    .set({ name: name ?? null, updatedAt: new Date() })
    .where(and(eq(itinerariesTable.id, id!), eq(itinerariesTable.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Itinerary not found" });
    return;
  }

  res.json(updated);
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
