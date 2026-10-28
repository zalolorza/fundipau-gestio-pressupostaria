import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

import * as schema from "./schema"

const url = process.env.DATABASE_URL
if (!url) throw new Error("Falta la variable d'entorn DATABASE_URL")

export const db = drizzle(neon(url), { schema, casing: "snake_case" })
export { schema }
