ALTER TABLE "postcode_zones" DROP COLUMN "zone_id";
--> statement-breakpoint
ALTER TABLE "postcode_zones" RENAME TO "postcodes";
