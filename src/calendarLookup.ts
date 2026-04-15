import { z } from "zod";
import { createRequire } from "module";
import type { Zone } from "./zoneClassifier.js";

// zod is a declared dependency — install it below if not present
// npm install zod

const zoneDataSchema = z.object({
  sow: z.array(z.number().int().min(1).max(12)),
  plant: z.array(z.number().int().min(1).max(12)).nullable(),
  harvest: z.array(z.number().int().min(1).max(12)),
});

const cropSchema = z.object({
  id: z.string(),
  name: z.string(),
  zones: z.object({
    "1": zoneDataSchema,
    "2": zoneDataSchema,
    "3": zoneDataSchema,
    "4": zoneDataSchema,
    "5": zoneDataSchema,
  }),
});

const cropsSchema = z.array(cropSchema);

export type CropEntry = z.infer<typeof cropSchema>;
export type ZoneData = z.infer<typeof zoneDataSchema>;

export interface CropCalendarEntry {
  id: string;
  name: string;
  sow: number[];
  plant: number[] | null;
  harvest: number[];
}

const require = createRequire(import.meta.url);
const raw: unknown = require("./data/crops.json");

const parseResult = cropsSchema.safeParse(raw);
if (!parseResult.success) {
  throw new Error(
    `crops.json failed validation: ${parseResult.error.message}`
  );
}

const crops: CropEntry[] = parseResult.data;

export function getCalendar(zone: Zone): CropCalendarEntry[] {
  const key = String(zone) as "1" | "2" | "3" | "4" | "5";
  return crops.map((crop) => ({
    id: crop.id,
    name: crop.name,
    ...crop.zones[key],
  }));
}
