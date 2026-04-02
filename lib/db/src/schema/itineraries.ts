import { pgTable, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const itinerariesTable = pgTable("itineraries", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  city: text("city").notNull(),
  tripDays: integer("trip_days").notNull(),
  pace: text("pace").notNull(),
  interests: jsonb("interests").notNull().$type<string[]>(),
  days: jsonb("days").notNull().$type<object[]>(),
  isOptimized: boolean("is_optimized").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertItinerarySchema = createInsertSchema(itinerariesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertItinerary = z.infer<typeof insertItinerarySchema>;
export type Itinerary = typeof itinerariesTable.$inferSelect;
