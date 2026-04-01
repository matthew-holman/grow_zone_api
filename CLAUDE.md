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
- **Postcode data**: GeoNames `SE.zip` (CC BY 4.0, attribution to geonames.org required) — loaded from `src/data/postcodes/SE.zip` at startup into an in-memory Map. No external API calls at runtime.

## Architecture and Key Decisions

**Monolith.** This is a single deployable unit. Do not suggest microservices, separate services, or splitting modules into independent deployables.

**Zone classifier is a pure function.** `src/zoneClassifier.ts` exports a single function `(lat: number, lng: number) => Zone | null`. It must remain pure — no DB access, no HTTP calls, no side effects. It must be independently testable without any test setup. Sweden's 5 zones are determined by latitude ranges; the classifier encodes that logic directly.

**Crop calendar data lives in `src/data/crops.json`.** This file is validated against a Zod schema at application startup. If it fails validation, the process must not start. Crop data is not stored in the database at this stage. It is the authoritative source for all horticultural logic and will be reviewed externally — keep it strictly separate from application code.

**Postcode lookup is local and synchronous.** `src/postcodeDb.ts` loads `SE.zip` at startup into a `Map<string, { lat, lng }>`. `lookupPostcode(postcode)` is a pure synchronous function — no network calls, no async. The resolved `lat`, `lng`, and `zone_id` are written to `postcode_zones` on first use and served from the DB on subsequent requests. Run `npm run db:seed-postcodes` to pre-populate all ~16,000 Swedish postcodes upfront.

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
  zoneClassifier.ts   — pure zone resolution function: (lat, lng) => Zone | null
  postcodeDb.ts       — loads SE.zip at startup, exposes lookupPostcode(postcode): PostcodeLocation | null
  calendarLookup.ts   — loads crops.json at startup, validates with Zod, exposes query functions
  routes/
    calendar.ts       — /calendar route: schemas, route definition, handler
  db/
    schema.ts         — Drizzle schema definitions
    migrations/       — generated migration files
  data/
    crops.json        — crop × zone calendar data (source of truth for horticultural logic)
    postcodes/
      SE.zip          — GeoNames Swedish postcode dataset (CC BY 4.0, geonames.org)
  scripts/
    seedPostcodes.ts  — one-off script to bulk-insert all postcodes into postcode_zones
  zoneClassifier.test.ts — unit tests for the zone classifier
```

## Conventions

**Validation at the boundary.** All route handlers validate inputs with Zod before any business logic runs. If a request fails validation, return a structured error immediately.

**Structured errors.** All error responses use the shape `{ error: string, message: string }`. Never let raw exceptions propagate to the HTTP response. Never return unstructured 500s.

**Routes orchestrate; modules do the work.** Route handlers call into `geocoder`, `zoneClassifier`, `calendarLookup`, and db modules — they do not contain business logic themselves.

**Pure functions preferred.** Side effects (database writes, HTTP calls) are pushed to the edges. Core logic — zone classification, calendar lookup — must be pure and independently testable.

**Crop data is separate.** `src/data/crops.json` is data, not code. Do not import application utilities into it, do not inline its contents into application modules, and do not move it into the database prematurely.

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

Phase 1 MVP. The immediate deliverable is a single `GET /calendar?postcode=` endpoint that:

1. Geocodes the postcode via Nominatim
2. Resolves the climate zone using the zone classifier
3. Looks up and returns a crop calendar from `crops.json`

The PostgreSQL schema and Drizzle setup must be scaffolded in this phase even though the current endpoint does not write to the database. The signup flow (next phase) will need it.

## Out of Scope

The following are explicitly not part of the current phase. Do not implement or scaffold them unless directly instructed:

- User authentication or session management
- Zone modifiers (greenhouse, elevation, balcony, soil type)
- Email or push reminders
- More than 5 crops
- Variety-level recommendations
- Any frontend or UI
