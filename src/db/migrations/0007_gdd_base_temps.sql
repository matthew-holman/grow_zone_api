ALTER TABLE "weather_stations" DROP COLUMN IF EXISTS "gdd_annual";
--> statement-breakpoint
ALTER TABLE "weather_stations" DROP COLUMN IF EXISTS "gdd_p10";
--> statement-breakpoint
ALTER TABLE "weather_stations" DROP COLUMN IF EXISTS "gdd_p90";
--> statement-breakpoint
ALTER TABLE "weather_stations" DROP COLUMN IF EXISTS "gdd_cv";
--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base5"      numeric(7, 1);
--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base5_p10"  numeric(7, 1);
--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base5_cv"   numeric(4, 2);
--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base7"      numeric(7, 1);
--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base7_p10"  numeric(7, 1);
--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base7_cv"   numeric(4, 2);
--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base10"     numeric(7, 1);
--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base10_p10" numeric(7, 1);
--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base10_cv"  numeric(4, 2);
--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base15"     numeric(7, 1);
--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base15_p10" numeric(7, 1);
--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base15_cv"  numeric(4, 2);
