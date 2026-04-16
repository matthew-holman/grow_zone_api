# Growzone — Claude Code Reference

## Project Overview

Growzone is a Swedish grow calendar API. A user provides a Swedish postcode and selects crops; the API returns a month-by-month sowing, planting, and harvest calendar calibrated to their local climate zone. Sweden is divided into 5 growing zones based on latitude. All climate logic, crop data, and recommendations are Sweden-specific. This is not a generic gardening tool.

## Tech Stack

- **Runtime**: Node 20
- **Language**: TypeScript (strict mode — `noImplicitAny`, `strictNullChecks`, explicit return types on exported functions)
- **Framework**: Hono via `OpenAPIHono` from `@hono/zod-openapi`
- **API docs**: `@hono/zod-openapi` for OpenAPI spec generation; `@scalar/hono-api-reference` for the interactive UI at `GET /docs`
- **Database**: PostgreSQL via Drizzle ORM
- **Validation**: Zod — used at API boundaries and to validate data files at startup
- **Testing**: Vitest
- **Postcode data**: Seeded from the `swedish-climate-data` pipeline into `postcode_zones`. No flat files loaded at runtime.

## Architecture — current state

The calendar pipeline has three stages:

1. `src/services/stationLookup.ts`
   Resolves a postcode to its 3 nearest SMHI weather stations using
   a Haversine SQL query against the weather_stations table.

2. `src/services/climateResolver.ts`
   Derives a ClimateProfile from the postcode's elevation and the
   3 nearest stations using inverse distance weighting and elevation
   lapse rate correction. Pure functions, no database dependency.

3. `src/services/calendarEngine.ts`
   Generates a growing calendar for all crops in the database from
   the resolved ClimateProfile. Pure functions, no database dependency.

The old zone classifier and zone-based crop data have been removed.
Do not reintroduce zone-based logic. All climate reasoning is derived
from real SMHI station data.

## Planned improvements

- Persist resolved ClimateProfile to postcode_zones to avoid
  recomputing on every request. The ClimateProfile type already
  includes postcode as a field for this reason.
- Admin UI for managing crops and crop methods.
- Support for perennial lifecycle crops (strawberry, raspberry etc).

## Architecture decisions

**Monolith.** This is a single deployable unit. Do not suggest microservices, separate services, or splitting modules into independent deployables.

**No in-process caching.** Do not introduce `Map`-based TTL caches, node-cache, Redis, or any other caching layer. PostgreSQL is the only data store. If performance becomes a concern, address it at the database level.

**No authentication yet.** Auth is planned but out of scope for the current phase. Do not scaffold auth middleware, JWT handling, session logic, or protected routes.

## Database

PostgreSQL accessed via Drizzle ORM. Schema definitions live in `src/db/schema.ts`. Generated migration files live in `src/db/migrations/`.

The `users` table stores:

| Column | Type |
|--------|------|
| `id` | UUID (primary key) |
| `email` | text |
| `postcode` | text |
| `lat` | double precision |
| `lng` | double precision |
| `zone_id` | integer |
| `created_at` | timestamp with time zone |

## Project Structure

```
src/
  index.ts            — entry point, starts the Hono server
  router.ts           — mounts domain routers, registers /openapi.json and /docs
  routes/
    calendar.ts       — /calendar route: schemas, route definition, handler
    adminCrops.ts     — /admin/crops CRUD routes
  services/
    stationLookup.ts  — resolves postcode → 3 nearest SMHI stations
    climateResolver.ts — derives ClimateProfile from stations + elevation
    calendarEngine.ts — generates growing calendar from ClimateProfile + crops
  repositories/
    cropRepository.ts      — all crop + method DB operations
    stationRepository.ts   — weather_stations table queries
  db/
    schema.ts         — Drizzle table definitions (source of truth for DB shape)
    types.ts          — Drizzle-inferred row types (SelectCrop, InsertCrop, etc.)
    migrations/       — generated migration files
  domain/
    climate.ts        — ClimateProfile, CalendarWindow, MethodCalendar, CropCalendar
    index.ts          — barrel export of all domain types
  validators/
    crops.ts          — Zod schemas derived from Drizzle via drizzle-zod
    index.ts          — barrel export
  data/
    postcodes/        — postcode input files (used by seed scripts only)
scripts/
  seed-stations.ts    — one-off script to bulk-insert SMHI weather stations
```

## Type system rules

**`src/db/schema.ts`** is the single source of truth for database table shapes. Never hand-write interfaces that mirror a DB table.

**`src/db/types.ts`** re-exports Drizzle-inferred types only (`type SelectCrop = typeof crops.$inferSelect`). No hand-written interfaces.

**`src/domain/`** holds types that exist purely in business logic with no direct DB row — `ClimateProfile`, `CalendarWindow`, `MethodCalendar`, `CropCalendar`, etc. Declared once, imported by both services and routes.

**`src/validators/`** holds all Zod schemas. Crop schemas are derived via `drizzle-zod` (`createInsertSchema`, `createSelectSchema`) with field-level overrides for enums and range constraints. Never hand-write crop schemas.

**`src/routes/`** files contain zero type or interface definitions. All types are imported from `domain/` or `validators/`.

## Conventions

**Validation at the boundary.** All route handlers validate inputs with Zod before any business logic runs. If a request fails validation, return a structured error immediately.

**Structured errors.** All error responses use the shape `{ error: string, message: string }`. Never let raw exceptions propagate to the HTTP response. Never return unstructured 500s.

**Routes orchestrate; modules do the work.** Route handlers call into `stationLookup`, `climateResolver`, `calendarEngine`, and repository modules — they do not contain business logic themselves.

**Pure functions preferred.** Side effects (database writes, HTTP calls) are pushed to the edges. Core logic — climate resolution, calendar generation — must be pure and independently testable.

## Climate Resolution — Sign Conventions

**`applyElevationCorrection` subtracts:** the formula is `value - (elevDeltaM / 100) * rate`. A positive rate *reduces* the value; a negative rate *increases* it.

**Frost day rates must be passed with care** — the direction of the calendar effect is the opposite of the sign:

| Field | Rate argument | Why |
|---|---|---|
| `lastFrostDoy`, `lastFrostP90` | `-FROST_DAYS_PER_100M` | Higher elevation → later spring frost → DOY must increase → negative rate |
| `firstFrostDoy`, `firstFrostP10` | `+FROST_DAYS_PER_100M` | Higher elevation → earlier autumn frost → DOY must decrease → positive rate |

Passing `+FROST_DAYS_PER_100M` for last frost or `-FROST_DAYS_PER_100M` for first frost silently inverts both corrections. The in-code comment in `src/services/climateResolver.ts` explains this with worked examples.

**GDD and temperature** use positive rates and are not affected by this inversion risk — higher elevation always means fewer degree-days and lower temperatures.

## OpenAPI / @hono/zod-openapi Conventions

The app uses `OpenAPIHono` throughout — never plain `Hono`. All routes are defined with `createRoute()` and registered with `app.openapi()`.

**Route files live in `src/routes/`, one file per domain.** Each file creates its own `OpenAPIHono` instance, defines route schemas and handlers locally, and exports the instance. `router.ts` mounts them with `app.route("/", domainRouter)`.

**Always pass an explicit status code to `c.json()`.** Hono's `c.json()` defaults the status type to the full `ContentfulStatusCode` union when no status argument is given. `RouteHandler<R>` expects a narrowed status (e.g. `200`). Omitting the status causes TS2322. Every `c.json()` call in an `openapi()` handler must include an explicit status:
```typescript
return c.json({ postcode, zone, crops }, 200);  // ✓
return c.json({ postcode, zone, crops });        // ✗ — TS2322
```

**Use `RouteHandler<typeof route>` to type standalone handler functions.** When a handler is defined as a separate variable rather than inline, annotate it with `RouteHandler<typeof myRoute>` imported from `@hono/zod-openapi`. This is preferred over inline anonymous functions for readability.

**`z` must be imported from `@hono/zod-openapi`, not `zod`.** The package re-exports Zod augmented with `.openapi()`. Importing from `zod` directly will miss this augmentation.

**Use `Scalar` (not the deprecated `apiReference` alias) and mount it with `app.use()`.** `Scalar` returns a `MiddlewareHandler`, not a route handler, so `app.get()` will produce a type error. The correct pattern:
```typescript
import { Scalar } from "@scalar/hono-api-reference";
app.use("/docs", Scalar({ url: "/openapi.json" }));
```

## Current Phase

The `GET /calendar?postcode=` endpoint is live. It:

1. Looks up the postcode location (lat, lng, elevationM) from `postcode_zones`
2. Queries the 3 nearest SMHI weather stations by Haversine distance
3. Derives a `ClimateProfile` using inverse distance weighting + elevation correction
4. Fetches all crops and methods from the database
5. Returns a structured growing calendar

## Data management

Crop data is stored in the `crops` and `crop_methods` database tables.
The database is the authoritative source of truth.

Postcode and weather station data are seeded from JSON files produced by
the `swedish-climate-data` repository. Those files are never edited
manually — regenerate them by running the climate pipeline and copying
the output, then run `npm run db:seed-stations`.

## Admin routes

CRUD routes for managing crop data are available under `/admin/crops`.
These are local development routes — no authentication is required
at this stage. Authentication should be added before any deployment.

Routes:
```
GET    /admin/crops
GET    /admin/crops/:id
POST   /admin/crops
PUT    /admin/crops/:id
DELETE /admin/crops/:id

GET    /admin/crops/:id/methods
POST   /admin/crops/:id/methods
PUT    /admin/crops/:id/methods/:mid
DELETE /admin/crops/:id/methods/:mid
```

Validation schemas live in `src/validators/crops.ts`.
Database operations live in `src/repositories/cropRepository.ts`.
Route handlers live in `src/routes/adminCrops.ts`.

Note: `DELETE /admin/crops/:id` cascades to all methods via the
database foreign key constraint — no application-level cascade needed.

The admin router uses plain `Hono` (not `OpenAPIHono`) and is not
included in the OpenAPI spec.

## Out of Scope

The following are explicitly not part of the current phase. Do not implement or scaffold them unless directly instructed:

- User authentication or session management
- Climate modifiers (greenhouse, elevation, balcony, soil type)
- Email or push reminders
- More than 5 crops
- Variety-level recommendations
- Any frontend or UI
