# growzone

Backend API for the Grow Zone app — serves Swedish growing-zone calendars by postcode.

Built with Hono, Drizzle ORM, and PostgreSQL.

## Prerequisites

- Node 20+
- Docker (for the database)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Key variables:

| Variable            | Description                                              |
|---------------------|----------------------------------------------------------|
| `DATABASE_URL`      | PostgreSQL connection string                             |
| `NOMINATIM_CONTACT` | Your email — included in API `User-Agent` headers       |

### 3. Start the database

```bash
docker compose up -d
```

### 4. Run migrations

```bash
npm run db:migrate
```

### 5. Seed postcode data

Populates `postcode_zones` from the bundled GeoNames dataset (`src/data/postcodes/SE.zip`). Safe to re-run — existing rows are skipped.

```bash
npm run db:seed-postcodes
```

### 6. Backfill elevation data

Fetches elevation for every row in `postcode_zones` from the Open-Elevation API. Waits 1 second between requests. Run once after seeding.

```bash
npx tsx scripts/backfill-elevation.ts
```

## Development

```bash
npm run dev    # Start dev server with hot reload (http://localhost:8000)
npm test       # Run tests
```

API docs are available at `http://localhost:8000/docs` when the server is running.

## Database

```bash
npm run db:generate   # Generate a new migration from schema changes
npm run db:migrate    # Apply pending migrations
```
