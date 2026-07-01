import "dotenv/config";
import { defineConfig } from "prisma/config";

// Use process.env (not the strict `env()` helper) so `prisma generate` works
// without a database URL, e.g. during the Docker build. CLI commands that
// actually connect (db push, studio) still require DATABASE_URL to be set.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
