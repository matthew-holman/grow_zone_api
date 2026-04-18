-- crops: add gdd_base_temp_c NOT NULL, backfill existing rows with 5, then drop the default
ALTER TABLE "crops" ADD COLUMN "gdd_base_temp_c" smallint NOT NULL DEFAULT 5;
--> statement-breakpoint
ALTER TABLE "crops" ALTER COLUMN "gdd_base_temp_c" DROP DEFAULT;
--> statement-breakpoint

-- crop_methods: rename gdd_required → gdd_to_maturity
ALTER TABLE "crop_methods" RENAME COLUMN "gdd_required" TO "gdd_to_maturity";
--> statement-breakpoint

-- crop_methods: add new GDD and indoor-start columns
ALTER TABLE "crop_methods" ADD COLUMN "gdd_to_maturity_p10" smallint;
--> statement-breakpoint
ALTER TABLE "crop_methods" ADD COLUMN "weeks_indoor_before_last_frost" smallint;
--> statement-breakpoint

-- crop_methods: drop static frost-offset column (now derived by the calendar engine)
ALTER TABLE "crop_methods" DROP COLUMN "plant_before_first_frost_days";
