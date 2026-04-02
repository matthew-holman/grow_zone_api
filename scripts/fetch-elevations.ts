/**
 * ELEVATION SEEDING SCRIPT
 *
 * Reads SRTM .hgt elevation tiles from a local directory and resolves
 * elevation for every postcode in the postcode_zones table. Output is
 * written to src/data/postcode-elevations.json which should be committed
 * to the repository. The .hgt files are never committed.
 *
 * ─────────────────────────────────────────────────────────────────────
 * BEFORE RUNNING THIS SCRIPT
 * ─────────────────────────────────────────────────────────────────────
 *
 * 1. Download SRTM tiles covering Sweden from USGS:
 *    https://e4ftl01.cr.usgs.gov/MEASURES/SRTMGL1.003/2000.02.11/
 *    http://viewfinderpanoramas.org/Coverage%20map%20viewfinderpanoramas_org3.htm
 *    You will need a free NASA Earthdata account:
 *    https://urs.earthdata.nasa.gov/users/new
 *
 *    Tiles needed for Sweden (N55–N69, E010–E024):
 *    N55E010 N55E011 N55E012 N55E013 N55E014 N55E015 N55E016 N55E017 N55E018 N55E019 N55E020 N55E021 N55E022 N55E023 N55E024
 *    N56E010 ... N56E024
 *    ... (same pattern through to N69E024)
 *
 *    Each file is named e.g. N59E018.SRTMGL1.hgt.zip
 *    Download and unzip into a single directory, e.g. ~/srtm-tiles/
 *    After unzipping you should have files named N59E018.hgt etc.
 *
 *    Alternative source (no login, 3-arc-second resolution):
 *    https://srtm.csi.cgiar.org/srtmdata/
 *
 * 2. Run this script pointing at that directory:
 *    npx tsx scripts/fetch-elevations.ts --tiles ~/srtm-tiles
 *
 * 3. Review the output and warnings, then commit the result:
 *    src/data/postcode-elevations.json
 *
 * 4. Apply elevations to the database:
 *    npx tsx scripts/seed-elevations.ts
 *
 * The .hgt files can be archived or deleted after the JSON is generated.
 * Re-run this script only if new postcodes are added to the database.
 * ─────────────────────────────────────────────────────────────────────
 */

import * as fs from 'fs'
import * as path from 'path'
import "dotenv/config";

// node-hgt is a dev dependency — only used in this script
// eslint-disable-next-line @typescript-eslint/no-require-imports
// @ts-ignore
import {Hgt} from 'node-hgt'
import {getAllPostcodes} from "../src/repositories/postcodeZoneRepository.js";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PostcodeRow {
    postcode: string
    lat: string
    lng: string
}

interface ElevationRecord {
    postcode: string
    lat: number
    lng: number
    elevation_m: number | null
}

// ─── Args ────────────────────────────────────────────────────────────────────

function parseTilesArg(): string {
    const idx = process.argv.indexOf('--tiles')
    if (idx === -1 || !process.argv[idx + 1]) {
        console.error(`
Usage:
  npx tsx scripts/fetch-elevations.ts --tiles <directory>

Example:
  npx tsx scripts/fetch-elevations.ts --tiles ~/srtm-tiles

The directory should contain unzipped SRTM .hgt files, e.g. N59E018.hgt
See the script header for full setup instructions.
    `.trim())
        process.exit(1)
    }

    const tilesDir = path.resolve(process.argv[idx + 1])

    if (!fs.existsSync(tilesDir)) {
        console.error(`Tiles directory not found: ${tilesDir}`)
        process.exit(1)
    }

    return tilesDir
}

// ─── Tile resolution ─────────────────────────────────────────────────────────

/**
 * Derives the SRTM .hgt filename for a given coordinate.
 * The tile covers from floor(lat) to floor(lat)+1, floor(lng) to floor(lng)+1.
 * e.g. lat=59.34, lng=18.06 → N59E018.hgt
 */
function tileFilename(lat: number, lng: number): string {
    const latPrefix = lat >= 0 ? 'N' : 'S'
    const lngPrefix = lng >= 0 ? 'E' : 'W'
    const latDeg = String(Math.floor(Math.abs(lat))).padStart(2, '0')
    const lngDeg = String(Math.floor(Math.abs(lng))).padStart(3, '0')
    return `${latPrefix}${latDeg}${lngPrefix}${lngDeg}`
}

/**
 * Finds the .hgt file path for a coordinate, checking both
 * .hgt and .hgt.zip extensions. Returns null if not found.
 */
function findTilePath(tilesDir: string, lat: number, lng: number): string | null {
    const base = tileFilename(lat, lng)
    const candidates = [
        path.join(tilesDir, `${base}.hgt`),
        path.join(tilesDir, `${base}.SRTMGL1.hgt`),
        path.join(tilesDir, `${base}.SRTMGL1.hgt.zip`),
        path.join(tilesDir, `${base}.hgt.zip`),
    ]

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate
    }
    return null
}

// ─── Elevation lookup ─────────────────────────────────────────────────────────

// Cache open Hgt instances by filename — avoid reopening the same tile
// repeatedly when multiple postcodes fall within the same 1°×1° cell.
const tileCache = new Map<string, InstanceType<typeof Hgt>>()

function getElevation(tilesDir: string, lat: number, lng: number): number | null {
    const tilePath = findTilePath(tilesDir, lat, lng)

    if (!tilePath) {
        return null
    }

    try {
        if (!tileCache.has(tilePath)) {
            // node-hgt Hgt constructor: (filePath, [swLat, swLng])
            const swLat = Math.floor(lat)
            const swLng = Math.floor(lng)
            tileCache.set(tilePath, new Hgt(tilePath, [swLat, swLng]))
        }

        const tile = tileCache.get(tilePath)!
        // getElevation takes [lat, lng] and returns metres as a number
        const elevation: number = tile.getElevation([lat, lng])
        return Math.round(elevation)
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.warn(`  Warning: failed to read elevation for [${lat}, ${lng}] from ${tilePath}: ${message}`)
        return null
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    const tilesDir = parseTilesArg()
    console.log(`Reading tiles from: ${tilesDir}\n`)

    // Fetch all postcodes from db
    const rows = await getAllPostcodes()

    if (rows.length === 0) {
        console.log('No postcodes found in postcode_zones table. Nothing to do.')
        process.exit(0)
    }

    console.log(`Found ${rows.length} postcodes to process.\n`)

    const results: ElevationRecord[] = []
    const missing: string[] = []

    for (const row of rows) {
        const lat = parseFloat(row.lat)
        const lng = parseFloat(row.lng)
        const elevation = getElevation(tilesDir, lat, lng)

        if (elevation === null) {
            const filename = tileFilename(lat, lng)
            console.warn(`  Missing tile: ${filename} — skipping ${row.postcode}`)
            missing.push(row.postcode)
        }

        results.push({
            postcode: row.postcode,
            lat,
            lng,
            elevation_m: elevation,
        })
    }

    // Write output
    const outputPath = path.resolve('src/data/postcode-elevations.json')
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8')

    // Summary
    const resolved = results.filter(r => r.elevation_m !== null).length
    console.log(`
─────────────────────────────────────────
Processed : ${rows.length} postcodes
Resolved  : ${resolved}
Missing   : ${missing.length}
Output    : ${outputPath}
─────────────────────────────────────────
  `.trim())

    if (missing.length > 0) {
        console.log('\nFor missing tiles, download the corresponding .hgt files')
        console.log('and re-run this script. See the script header for details.')
    }

    process.exit(0)
}

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})