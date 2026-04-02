# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (no user API key needed)

## Artifacts

### AI Travel Itinerary Planner (`artifacts/travel-planner`)
- Expo mobile app (React Native)
- 3-tab layout: Plan, Saved, Profile
- AI-powered itinerary generation using OpenAI gpt-5.2
- Deterministic ranking/sequencing with nearest-neighbor heuristic
- Authentication (email/password) for saving itineraries
- AsyncStorage for local session/draft persistence

### API Server (`artifacts/api-server`)
- Express 5 backend
- Routes: `/api/auth/*` (register, login, logout, me), `/api/itinerary/*` (generate, CRUD)
- In-memory token session store (24h expiry)
- OpenAI integration for activity generation

## Database Schema

- `users`: id, email, password_hash, name, created_at
- `itineraries`: id, user_id, city, trip_days, pace, interests (jsonb), days (jsonb), is_optimized, created_at, updated_at

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Activity Categories
museum, landmark, park, restaurant, shopping, entertainment, cultural, outdoor, nightlife, tour

## User Interests
history, art, food, nature, architecture, nightlife, shopping, sports

## PRD Compliance
- ≤ 20s generation time target (P95)
- Activity counts: relaxed=2/day, standard=3/day, packed=4/day
- Nearest-neighbor sequencing for route efficiency
- Scoring: interest_match×0.6 + category_popularity×0.3 + diversity_bonus×0.1
- Seeded randomness for regeneration with ≥25% difference
- Fallback tier logging
- Edit operations: remove + reorder only (no re-optimization)
- "Optimized" label removed after any edit
- Warning on unsaved changes navigation

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
