import { pgTable, text, numeric, smallint, timestamp } from "drizzle-orm/pg-core";

export const postcodeZones = pgTable("postcode_zones", {
  postcode: text("postcode").primaryKey(),
  lat: numeric("lat", { precision: 9, scale: 6 }).notNull(),
  lng: numeric("lng", { precision: 9, scale: 6 }).notNull(),
  zoneId: smallint("zone_id").notNull(),
  placeName: text("place_name").notNull(),
  adminName1: text("admin_name1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
