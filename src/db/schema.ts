import { pgTable, text, numeric, smallint, integer, timestamp } from "drizzle-orm/pg-core";

export const postcodes = pgTable("postcodes", {
  postcode:   text("postcode").primaryKey(),
  lat:        numeric("lat", { precision: 9, scale: 6 }).notNull(),
  lng:        numeric("lng", { precision: 9, scale: 6 }).notNull(),
  placeName:  text("place_name").notNull(),
  adminName1: text("admin_name1"),
  elevationM: smallint("elevation_m").notNull(),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const weatherStations = pgTable('weather_stations', {
  id:               integer('id').primaryKey(),
  name:             text('name').notNull(),
  lat:              numeric('lat', { precision: 9, scale: 6 }).notNull(),
  lng:              numeric('lng', { precision: 9, scale: 6 }).notNull(),
  elevationM:       numeric('elevation_m', { precision: 7, scale: 3 }).notNull(),
  lastFrostDoy:     smallint('last_frost_doy'),
  lastFrostP90:     smallint('last_frost_p90'),
  firstFrostDoy:    smallint('first_frost_doy'),
  firstFrostP10:    smallint('first_frost_p10'),
  growingDays:      smallint('growing_days'),
  gddBase5:         numeric('gdd_base5',      { precision: 7, scale: 1 }),
  gddBase5P10:      numeric('gdd_base5_p10',  { precision: 7, scale: 1 }),
  gddBase5Cv:       numeric('gdd_base5_cv',   { precision: 4, scale: 2 }),
  gddBase7:         numeric('gdd_base7',      { precision: 7, scale: 1 }),
  gddBase7P10:      numeric('gdd_base7_p10',  { precision: 7, scale: 1 }),
  gddBase7Cv:       numeric('gdd_base7_cv',   { precision: 4, scale: 2 }),
  gddBase10:        numeric('gdd_base10',     { precision: 7, scale: 1 }),
  gddBase10P10:     numeric('gdd_base10_p10', { precision: 7, scale: 1 }),
  gddBase10Cv:      numeric('gdd_base10_cv',  { precision: 4, scale: 2 }),
  gddBase15:        numeric('gdd_base15',     { precision: 7, scale: 1 }),
  gddBase15P10:     numeric('gdd_base15_p10', { precision: 7, scale: 1 }),
  gddBase15Cv:      numeric('gdd_base15_cv',  { precision: 4, scale: 2 }),
  monthlyMeanTemps: numeric('monthly_mean_temps', { precision: 4, scale: 1 })
                      .array()
                      .notNull(),
  createdAt:        timestamp('created_at', { withTimezone: true })
                      .notNull()
                      .defaultNow(),
});

export const crops = pgTable('crops', {
  id:                   text('id').primaryKey(),
  nameSv:               text('name_sv').notNull(),
  nameEn:               text('name_en').notNull(),
  lifecycle:            text('lifecycle').notNull(),
  frostTolerance:       text('frost_tolerance').notNull(),
  minNightTempC:        smallint('min_night_temp_c'),
  daylengthRequirement: text('daylength_requirement').notNull().default('neutral'),
  gddBaseTempC:         smallint('gdd_base_temp_c').notNull(),
  notesSv:              text('notes_sv'),
  notesEn:              text('notes_en'),
  createdAt:            timestamp('created_at', { withTimezone: true })
                          .notNull()
                          .defaultNow(),
});

export const cropMethods = pgTable('crop_methods', {
  id:                        text('id').primaryKey(),
  cropId:                    text('crop_id')
                               .notNull()
                               .references(() => crops.id, { onDelete: 'cascade' }),
  labelSv:                   text('label_sv').notNull(),
  labelEn:                   text('label_en').notNull(),
  germinationMinSoilTempC:   smallint('germination_min_soil_temp_c'),
  germinationOptSoilTempC:   smallint('germination_opt_soil_temp_c'),
  daysToGerminationMin:      smallint('days_to_germination_min'),
  daysToGerminationMax:      smallint('days_to_germination_max'),
  daysToMaturityMin:         smallint('days_to_maturity_min'),
  daysToMaturityMax:         smallint('days_to_maturity_max'),
  transplantTolerance:        text('transplant_tolerance').notNull(),
  gddToMaturity:              smallint('gdd_to_maturity'),
  gddToMaturityP10:           smallint('gdd_to_maturity_p10'),
  weeksIndoorBeforeLastFrost: smallint('weeks_indoor_before_last_frost'),
  sortOrder:                  smallint('sort_order').notNull().default(0),
  createdAt:                 timestamp('created_at', { withTimezone: true })
                               .notNull()
                               .defaultNow(),
});
