ALTER TABLE "postcode_zones" RENAME TO "postcodes";--> statement-breakpoint
ALTER TABLE "weather_stations" RENAME COLUMN "gdd_annual" TO "gdd_base5";--> statement-breakpoint
ALTER TABLE "weather_stations" RENAME COLUMN "gdd_p10" TO "gdd_base5_p10";--> statement-breakpoint
ALTER TABLE "weather_stations" RENAME COLUMN "gdd_cv" TO "gdd_base5_cv";--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base7" numeric(7, 1);--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base7_p10" numeric(7, 1);--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base7_cv" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base10" numeric(7, 1);--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base10_p10" numeric(7, 1);--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base10_cv" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base15" numeric(7, 1);--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base15_p10" numeric(7, 1);--> statement-breakpoint
ALTER TABLE "weather_stations" ADD COLUMN "gdd_base15_cv" numeric(4, 2);--> statement-breakpoint
ALTER TABLE "postcodes" DROP COLUMN "zone_id";--> statement-breakpoint
ALTER TABLE "weather_stations" DROP COLUMN "gdd_p90";