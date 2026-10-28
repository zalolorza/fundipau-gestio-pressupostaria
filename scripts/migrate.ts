import "dotenv/config"
import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { migrate } from "drizzle-orm/neon-http/migrator"

async function main() {
  const db = drizzle(neon(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!))
  await migrate(db, { migrationsFolder: "./drizzle" })
  console.log("✓ Migracions aplicades")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
