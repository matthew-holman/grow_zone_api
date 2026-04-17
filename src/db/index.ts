import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { postcodes, weatherStations, crops, cropMethods } from "./schema.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool);
export { postcodes, weatherStations, crops, cropMethods };
